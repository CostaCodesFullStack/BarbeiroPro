import { HttpError, ok, readJson, route } from "@/lib/api";
import { requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { idParam } from "@/lib/schemas/common";
import { serviceUpdateSchema } from "@/lib/schemas/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireAuth();
  const { id } = idParam.parse(await params);

  const service = await withTenant(session.tenantId, (tx) =>
    tx.service.findFirst({ where: { id } }),
  );
  if (!service) throw new HttpError(404, "NOT_FOUND", "Servico nao encontrado");
  return ok(service);
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth("services:manage");
  const { id } = idParam.parse(await params);
  const input = serviceUpdateSchema.parse(await readJson(req));

  const service = await withTenant(session.tenantId, (tx) =>
    tx.service.update({ where: { id }, data: input }),
  );
  return ok(service);
});

/** "Excluir" = desativar (agendamentos antigos continuam apontando para o servico). */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth("services:manage");
  const { id } = idParam.parse(await params);

  const service = await withTenant(session.tenantId, (tx) =>
    tx.service.update({ where: { id }, data: { active: false } }),
  );
  return ok(service);
});
