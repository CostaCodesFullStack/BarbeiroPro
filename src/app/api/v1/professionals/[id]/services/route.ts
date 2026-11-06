import { HttpError, ok, readJson, route } from "@/lib/api";
import { requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { idParam } from "@/lib/schemas/common";
import { professionalServicesSchema } from "@/lib/schemas/professional";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireAuth();
  const { id } = idParam.parse(await params);

  const links = await withTenant(session.tenantId, async (tx) => {
    const professional = await tx.professional.findFirst({ where: { id }, select: { id: true } });
    if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");
    return tx.professionalService.findMany({
      where: { professionalId: id },
      select: { serviceId: true, customPriceCents: true },
    });
  });
  return ok(links);
});

/** Define quais servicos o profissional realiza (substitui a lista inteira). */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth("professionals:manage");
  const { id } = idParam.parse(await params);
  const input = professionalServicesSchema.parse(await readJson(req));

  const links = await withTenant(session.tenantId, async (tx) => {
    const professional = await tx.professional.findFirst({ where: { id }, select: { id: true } });
    if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");

    // O RLS so deixa enxergar servicos da propria barbearia: ids de outra barbearia nao aparecem aqui.
    const found = await tx.service.findMany({
      where: { id: { in: input.services.map((s) => s.serviceId) } },
      select: { id: true },
    });
    if (found.length !== input.services.length) {
      throw new HttpError(422, "INVALID_SERVICE", "Um ou mais servicos nao existem");
    }

    await tx.professionalService.deleteMany({ where: { professionalId: id } });
    await tx.professionalService.createMany({
      data: input.services.map((s) => ({
        tenantId: session.tenantId,
        professionalId: id,
        serviceId: s.serviceId,
        customPriceCents: s.customPriceCents ?? null,
      })),
    });
    return tx.professionalService.findMany({
      where: { professionalId: id },
      select: { serviceId: true, customPriceCents: true },
    });
  });
  return ok(links);
});
