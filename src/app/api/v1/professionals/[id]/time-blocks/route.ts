import { HttpError, ok, readJson, route } from "@/lib/api";
import { assertAgendaWrite, requireAuth, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { idParam } from "@/lib/schemas/common";
import { timeBlockCreateSchema, timeBlockListQuery } from "@/lib/schemas/time-block";

type Ctx = { params: Promise<{ id: string }> };

/** Lista bloqueios. Padrao: de agora em diante. Filtros opcionais: ?from=&to= (ISO 8601). */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const session = await requireAuth();
  const { id } = idParam.parse(await params);
  const q = timeBlockListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const from = q.from ?? new Date();

  const blocks = await withTenant(session.tenantId, async (tx) => {
    const professional = await tx.professional.findFirst({ where: { id }, select: { id: true } });
    if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");
    return tx.timeBlock.findMany({
      where: {
        professionalId: id,
        endAt: { gt: from },
        ...(q.to ? { startAt: { lt: q.to } } : {}),
      },
      orderBy: { startAt: "asc" },
    });
  });
  return ok(blocks);
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth();
  const { id } = idParam.parse(await params);
  const input = timeBlockCreateSchema.parse(await readJson(req));

  const block = await withTenant(session.tenantId, async (tx) => {
    const professional = await tx.professional.findFirst({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!professional) throw new HttpError(404, "NOT_FOUND", "Profissional nao encontrado");
    assertAgendaWrite(session, professional);

    return tx.timeBlock.create({
      data: {
        tenantId: session.tenantId,
        professionalId: id,
        startAt: input.startAt,
        endAt: input.endAt,
        reason: input.reason,
      },
    });
  });
  return ok(block, 201);
});
