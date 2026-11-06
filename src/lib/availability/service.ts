import type { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { computeSlots } from "./engine";
import { dayRange, TZ, weekdayOf } from "./tz";

export type AvailabilityParams = {
  professionalId: string;
  serviceId: string;
  /** YYYY-MM-DD, dia local. */
  date: string;
  now?: Date;
  minNoticeMin?: number;
  stepMin?: number;
};

/**
 * Busca no banco tudo que influencia a agenda e calcula os horarios livres.
 * Deve ser chamada dentro de withTenant() (o RLS garante que so enxerga a propria barbearia).
 */
export async function getAvailableSlots(tx: Prisma.TransactionClient, p: AvailabilityParams) {
  const professional = await tx.professional.findFirst({
    where: { id: p.professionalId, active: true },
    select: { id: true },
  });
  if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");

  const service = await tx.service.findFirst({
    where: { id: p.serviceId, active: true },
    select: { id: true, durationMin: true },
  });
  if (!service) throw new HttpError(404, "NOT_FOUND", "Servico nao encontrado");

  const performs = await tx.professionalService.findFirst({
    where: { professionalId: professional.id, serviceId: service.id },
    select: { id: true },
  });
  if (!performs) {
    throw new HttpError(422, "SERVICE_NOT_OFFERED", "Este profissional nao realiza este servico");
  }

  const workDay = await tx.workingHour.findFirst({
    where: { professionalId: professional.id, weekday: weekdayOf(p.date) },
    select: { startTime: true, endTime: true, breakStart: true, breakEnd: true },
  });

  const range = dayRange(p.date);

  const blocks = await tx.timeBlock.findMany({
    where: { professionalId: professional.id, startAt: { lt: range.end }, endAt: { gt: range.start } },
    select: { startAt: true, endAt: true },
  });
  const appointments = await tx.appointment.findMany({
    where: {
      professionalId: professional.id,
      status: { notIn: ["CANCELED", "NO_SHOW"] },
      startAt: { lt: range.end },
      endAt: { gt: range.start },
    },
    select: { startAt: true, endAt: true },
  });

  const busy = [...blocks, ...appointments].map((b) => ({ start: b.startAt, end: b.endAt }));

  const slots = computeSlots({
    date: p.date,
    workDay,
    durationMin: service.durationMin,
    busy,
    now: p.now ?? new Date(),
    minNoticeMin: p.minNoticeMin,
    stepMin: p.stepMin,
  });

  return {
    date: p.date,
    timezone: TZ,
    durationMin: service.durationMin,
    slots: slots.map((s) => s.toISOString()),
  };
}
