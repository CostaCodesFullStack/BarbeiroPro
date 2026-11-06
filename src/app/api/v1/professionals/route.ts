import { ok, readJson, route } from "@/lib/api";
import { requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { professionalCreateSchema } from "@/lib/schemas/professional";

export const GET = route(async (req: Request) => {
  const session = await requireAuth();
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true";

  const professionals = await withTenant(session.tenantId, (tx) =>
    tx.professional.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: "asc" },
    }),
  );
  return ok(professionals);
});

export const POST = route(async (req: Request) => {
  const session = await requireWriteAuth("professionals:manage");
  const input = professionalCreateSchema.parse(await readJson(req));

  const professional = await withTenant(session.tenantId, (tx) =>
    tx.professional.create({ data: { ...input, tenantId: session.tenantId } }),
  );
  return ok(professional, 201);
});
