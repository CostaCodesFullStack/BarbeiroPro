import { HttpError, ok, readJson, route } from "@/lib/api";
import { assertAgendaWrite, requireWriteAuth } from "@/lib/auth/guard";
import { canTransition } from "@/lib/appointments/status";
import { withTenant } from "@/lib/db";
import { appointmentStatusSchema } from "@/lib/schemas/appointment";
import { idParam } from "@/lib/schemas/common";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/v1/appointments/:id/status  { "status": "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW" } */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth();
  const { id } = idParam.parse(await params);
  const { status } = appointmentStatusSchema.parse(await readJson(req));

  const updated = await withTenant(session.tenantId, async (tx) => {
    const current = await tx.appointment.findFirst({
      where: { id },
      select: { id: true, status: true, professional: { select: { userId: true } } },
    });
    if (!current) throw new HttpError(404, "NOT_FOUND", "Agendamento nao encontrado");
    assertAgendaWrite(session, current.professional);

    if (!canTransition(current.status, status)) {
      throw new HttpError(
        409,
        "INVALID_TRANSITION",
        `Nao e possivel mudar de ${current.status} para ${status}`,
      );
    }
    return tx.appointment.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, startAt: true, endAt: true, priceCents: true },
    });
  });
  return ok(updated);
});
