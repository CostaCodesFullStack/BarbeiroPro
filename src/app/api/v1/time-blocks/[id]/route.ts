import { HttpError, ok, route } from "@/lib/api";
import { assertAgendaWrite, requireWriteAuth } from "@/lib/auth/guard";
import { withTenant } from "@/lib/db";
import { idParam } from "@/lib/schemas/common";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const session = await requireWriteAuth();
  const { id } = idParam.parse(await params);

  await withTenant(session.tenantId, async (tx) => {
    const block = await tx.timeBlock.findFirst({
      where: { id },
      select: { id: true, professional: { select: { userId: true } } },
    });
    if (!block) throw new HttpError(404, "NOT_FOUND", "Bloqueio nao encontrado");
    assertAgendaWrite(session, block.professional);
    await tx.timeBlock.delete({ where: { id } });
  });
  return ok({ deleted: true });
});
