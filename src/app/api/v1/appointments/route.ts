import { ok, readJson, route } from "@/lib/api";
import { assertAgendaWrite, requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { appointmentSelect, createAppointment } from "@/lib/appointments/create";
import { dayRange } from "@/lib/availability/tz";
import { withTenant } from "@/lib/db";
import { can } from "@/lib/permissions";
import { appointmentCreateSchema, appointmentListQuery } from "@/lib/schemas/appointment";

/** Agenda do dia: GET /api/v1/appointments?date=YYYY-MM-DD[&professionalId=] */
export const GET = route(async (req: Request) => {
  const session = await requireAuth();
  const q = appointmentListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const range = dayRange(q.date);

  // Quem só vê a própria agenda (barbeiro) enxerga apenas os atendimentos do seu profissional.
  const onlyOwn = !can(session.role, "agenda:read:all");

  const items = await withTenant(session.tenantId, (tx) =>
    tx.appointment.findMany({
      where: {
        startAt: { gte: range.start, lt: range.end },
        ...(q.professionalId ? { professionalId: q.professionalId } : {}),
        ...(onlyOwn ? { professional: { userId: session.userId } } : {}),
      },
      select: appointmentSelect,
      orderBy: { startAt: "asc" },
    }),
  );
  return ok(items);
});

export const POST = route(async (req: Request) => {
  const session = await requireWriteAuth();
  const input = appointmentCreateSchema.parse(await readJson(req));

  const appointment = await createAppointment(
    {
      tenantId: session.tenantId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      clientId: input.clientId,
      client: input.client,
      source: "PANEL",
    },
    (professional) => assertAgendaWrite(session, professional),
  );
  return ok(appointment, 201);
});
