import { ok, readJson, route } from "@/lib/api";
import { requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { serviceCreateSchema } from "@/lib/schemas/service";

export const GET = route(async (req: Request) => {
  const session = await requireAuth();
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true";

  const services = await withTenant(session.tenantId, (tx) =>
    tx.service.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: "asc" },
    }),
  );
  return ok(services);
});

export const POST = route(async (req: Request) => {
  const session = await requireWriteAuth("services:manage");
  const input = serviceCreateSchema.parse(await readJson(req));

  const service = await withTenant(session.tenantId, (tx) =>
    tx.service.create({ data: { ...input, tenantId: session.tenantId } }),
  );
  return ok(service, 201);
});
