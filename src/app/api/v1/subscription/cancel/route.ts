import { HttpError, ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { deleteSubscription } from "@/lib/billing/asaas";
import { prisma } from "@/lib/db";

/**
 * Cancela a assinatura. Os dados são PRESERVADOS (o painel fica somente leitura).
 * Hoje o cancelamento vale na hora; ver AGENTS.md, seção 14 (acesso até o fim do período pago).
 */
export const POST = route(async () => {
  const session = await requireAuth("subscription:manage");

  const sub = await prisma.subscription.findUnique({ where: { tenantId: session.tenantId } });
  if (!sub) throw new HttpError(404, "NOT_FOUND", "Assinatura não encontrada");
  if (sub.status === "CANCELED") throw new HttpError(409, "ALREADY_CANCELED", "A assinatura já está cancelada.");

  if (sub.gatewaySubscriptionId) await deleteSubscription(sub.gatewaySubscriptionId);

  await prisma.subscription.update({ where: { tenantId: session.tenantId }, data: { status: "CANCELED" } });
  return ok({ status: "CANCELED" });
});
