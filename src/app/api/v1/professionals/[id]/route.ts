import { HttpError, ok, readJson, route } from "@/lib/api";
import { requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { idParam } from "@/lib/schemas/common";
import { professionalUpdateSchema } from "@/lib/schemas/professional";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireAuth();
  const { id } = idParam.parse(await params);

  const professional = await withTenant(session.tenantId, (tx) =>
    tx.professional.findFirst({ where: { id } }),
  );
  if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");
  return ok(professional);
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth("professionals:manage");
  const { id } = idParam.parse(await params);
  const input = professionalUpdateSchema.parse(await readJson(req));

  const professional = await withTenant(session.tenantId, (tx) =>
    tx.professional.update({ where: { id }, data: input }),
  );
  return ok(professional);
});

/** "Excluir" = desativar. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth("professionals:manage");
  const { id } = idParam.parse(await params);

  const professional = await withTenant(session.tenantId, (tx) =>
    tx.professional.update({ where: { id }, data: { active: false } }),
  );
  return ok(professional);
});
