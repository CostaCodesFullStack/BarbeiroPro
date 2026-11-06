import { HttpError, ok, readJson, route } from "@/lib/api";
import { requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { idParam } from "@/lib/schemas/common";
import { workingHoursSchema } from "@/lib/schemas/working-hours";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireAuth();
  const { id } = idParam.parse(await params);

  const hours = await withTenant(session.tenantId, async (tx) => {
    const professional = await tx.professional.findFirst({ where: { id }, select: { id: true } });
    if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");
    return tx.workingHour.findMany({ where: { professionalId: id }, orderBy: { weekday: "asc" } });
  });
  return ok(hours);
});

/** Substitui a semana inteira de uma vez. Dias nao enviados ficam como "nao trabalha". */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth("professionals:manage");
  const { id } = idParam.parse(await params);
  const input = workingHoursSchema.parse(await readJson(req));

  const hours = await withTenant(session.tenantId, async (tx) => {
    const professional = await tx.professional.findFirst({ where: { id }, select: { id: true } });
    if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");

    await tx.workingHour.deleteMany({ where: { professionalId: id } });
    await tx.workingHour.createMany({
      data: input.days.map((d) => ({
        tenantId: session.tenantId,
        professionalId: id,
        weekday: d.weekday,
        startTime: d.startTime,
        endTime: d.endTime,
        breakStart: d.breakStart ?? null,
        breakEnd: d.breakEnd ?? null,
      })),
    });
    return tx.workingHour.findMany({ where: { professionalId: id }, orderBy: { weekday: "asc" } });
  });
  return ok(hours);
});
