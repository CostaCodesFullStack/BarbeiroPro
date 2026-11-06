import { ok, route } from "@/lib/api";
import { withTenant } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit";
import { enforceRateLimit, getBookableTenant } from "@/lib/public/guard";

type Ctx = { params: Promise<{ slug: string }> };

/** Dados para montar a página pública: barbearia, serviços e profissionais que podem ser agendados. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  enforceRateLimit(`pub-info:${clientIp(req)}`, 60, 60_000);

  const tenant = await getBookableTenant(slug);

  const data = await withTenant(tenant.id, async (tx) => {
    const services = await tx.service.findMany({
      where: { active: true },
      select: { id: true, name: true, durationMin: true, priceCents: true },
      orderBy: { name: "asc" },
    });
    const professionals = await tx.professional.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const links = await tx.professionalService.findMany({
      select: { professionalId: true, serviceId: true, customPriceCents: true },
    });
    const withHours = await tx.workingHour.findMany({
      select: { professionalId: true },
      distinct: ["professionalId"],
    });

    const activeServiceIds = new Set(services.map((s) => s.id));
    const hasHours = new Set(withHours.map((h) => h.professionalId));

    return {
      services,
      // Só aparece quem tem horário de trabalho e ao menos um serviço ativo.
      professionals: professionals
        .map((p) => ({
          id: p.id,
          name: p.name,
          services: links
            .filter((l) => l.professionalId === p.id && activeServiceIds.has(l.serviceId))
            .map((l) => ({ serviceId: l.serviceId, customPriceCents: l.customPriceCents })),
        }))
        .filter((p) => hasHours.has(p.id) && p.services.length > 0),
    };
  });

  return ok({
    tenant: { name: tenant.name, phone: tenant.phone, address: tenant.address },
    ...data,
  });
});
