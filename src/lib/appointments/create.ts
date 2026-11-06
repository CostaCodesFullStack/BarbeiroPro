import { HttpError } from "@/lib/api";
import { getAvailableSlots } from "@/lib/availability/service";
import { localDateOf } from "@/lib/availability/tz";
import { withTenant } from "@/lib/db";

export const appointmentSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  source: true,
  priceCents: true,
  client: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true, durationMin: true } },
  professional: { select: { id: true, name: true } },
} as const;

export type NewAppointmentInput = {
  tenantId: string;
  professionalId: string;
  serviceId: string;
  startAt: Date;
  /** Cliente já cadastrado OU dados para criar/reaproveitar pelo telefone. */
  clientId?: string;
  client?: { name: string; phone: string; email?: string };
  source: "PANEL" | "ONLINE";
  /** Antecedência mínima em minutos (painel: 0). */
  minNoticeMin?: number;
  /** Máximo de agendamentos futuros em aberto por cliente (painel: sem limite). */
  maxActivePerClient?: number;
};

/**
 * Regra única de criação de agendamento, usada pelo painel e pela página pública:
 * valida profissional/serviço/vínculo, confirma que o horário está livre
 * e grava. Se duas requisições disputarem o mesmo horário, o banco recusa a segunda (409).
 *
 * `authorize` (opcional) roda logo após carregar o profissional, para checar permissões.
 */
export async function createAppointment(
  input: NewAppointmentInput,
  authorize?: (professional: { id: string; userId: string | null }) => void,
) {
  try {
    return await withTenant(input.tenantId, async (tx) => {
      const professional = await tx.professional.findFirst({
        where: { id: input.professionalId, active: true },
        select: { id: true, userId: true },
      });
      if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional não encontrado");
      authorize?.(professional);

      const availability = await getAvailableSlots(tx, {
        professionalId: input.professionalId,
        serviceId: input.serviceId,
        date: localDateOf(input.startAt),
        minNoticeMin: input.minNoticeMin,
      });
      if (!availability.slots.includes(input.startAt.toISOString())) {
        throw new HttpError(409, "SLOT_UNAVAILABLE", "Este horário não está disponível");
      }

      const link = await tx.professionalService.findFirstOrThrow({
        where: { professionalId: input.professionalId, serviceId: input.serviceId },
        select: { customPriceCents: true, service: { select: { durationMin: true, priceCents: true } } },
      });

      let clientId = input.clientId;
      if (clientId) {
        const found = await tx.client.findFirst({ where: { id: clientId }, select: { id: true } });
        if (!found) throw new HttpError(404, "NOT_FOUND", "Cliente não encontrado");
      } else if (input.client) {
        const existing = await tx.client.findFirst({
          where: { phone: input.client.phone },
          select: { id: true },
        });
        clientId = existing?.id;
      }

      if (input.maxActivePerClient !== undefined && clientId) {
        const open = await tx.appointment.count({
          where: {
            clientId,
            startAt: { gt: new Date() },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
        });
        if (open >= input.maxActivePerClient) {
          throw new HttpError(
            422,
            "CLIENT_LIMIT",
            "Você já tem agendamentos em aberto. Entre em contato com a barbearia para mais horários.",
          );
        }
      }

      if (!clientId) {
        if (!input.client) throw new HttpError(422, "VALIDATION_ERROR", "Informe os dados do cliente");
        clientId = (
          await tx.client.create({
            data: {
              tenantId: input.tenantId,
              name: input.client.name,
              phone: input.client.phone,
              email: input.client.email,
            },
            select: { id: true },
          })
        ).id;
      }

      return tx.appointment.create({
        data: {
          tenantId: input.tenantId,
          clientId,
          professionalId: input.professionalId,
          serviceId: input.serviceId,
          startAt: input.startAt,
          endAt: new Date(input.startAt.getTime() + link.service.durationMin * 60_000),
          priceCents: link.customPriceCents ?? link.service.priceCents,
          status: "SCHEDULED",
          source: input.source,
        },
        select: appointmentSelect,
      });
    });
  } catch (err) {
    // Corrida entre duas requisições para o mesmo horário: o banco recusa a segunda.
    if (err instanceof Error && /appointments_no_overlap|23P01/.test(err.message)) {
      throw new HttpError(409, "SLOT_UNAVAILABLE", "Este horário acabou de ser ocupado");
    }
    throw err;
  }
}
