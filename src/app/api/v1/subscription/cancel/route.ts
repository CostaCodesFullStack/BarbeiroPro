import { HttpError, ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { cancellationAccessEnd, cancellationState } from "@/lib/billing/cancellation";
import { deleteSubscription } from "@/lib/billing/asaas";
import { isCheckoutInProgress } from "@/lib/billing/checkout-recovery";
import { prisma } from "@/lib/db";
import type { SubscriptionStatus } from "@prisma/client";

type CancellationSnapshot = {
  id: string;
  status: SubscriptionStatus;
  gatewaySubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  accessEndsAt: Date | null;
  cancellationConfirmed: boolean;
  checkoutStatus: string | null;
};

/** Cancels the Asaas recurrence and preserves the customer's paid access window. */
export const POST = route(async () => {
  const session = await requireAuth("subscription:manage");
  const requestedAt = new Date();

  // Checkout and cancellation share this row lock: cancellation cannot race an
  // Asaas subscription create whose id has not yet been persisted locally.
  const sub = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<CancellationSnapshot[]>`
      SELECT id::text AS id,
             status::text AS status,
             gateway_subscription_id AS "gatewaySubscriptionId",
             current_period_end AS "currentPeriodEnd",
             access_ends_at AS "accessEndsAt",
             cancellation_confirmed AS "cancellationConfirmed",
             checkout_status AS "checkoutStatus"
      FROM subscriptions
      WHERE tenant_id = ${session.tenantId}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) throw new HttpError(404, "NOT_FOUND", "Assinatura n\u00e3o encontrada.");
    if (isCheckoutInProgress(current.checkoutStatus)) {
      throw new HttpError(409, "CHECKOUT_PENDING", "A ativa\u00e7\u00e3o ainda est\u00e1 sendo confirmada. Tente cancelar novamente quando o checkout terminar.");
    }
    if (current.status === "CANCELED" || (current.cancellationConfirmed && current.accessEndsAt)) {
      throw new HttpError(409, "ALREADY_CANCELED", "A renova\u00e7\u00e3o j\u00e1 foi cancelada.");
    }

    const accessEndsAt = cancellationAccessEnd(current.status, current.currentPeriodEnd, requestedAt);
    if (!accessEndsAt) {
      throw new HttpError(409, "PERIOD_END_UNKNOWN", "N\u00e3o foi poss\u00edvel determinar o fim do per\u00edodo pago. Entre em contato com o suporte.");
    }
    await tx.subscription.update({
      where: { id: current.id },
      data: { accessEndsAt, cancellationConfirmed: false },
    });
    return { ...current, accessEndsAt };
  });

  // A successful payment webhook may extend the paid period while the remote
  // cancellation request is being prepared. Preserve that newer end date.
  const latestBeforeDelete = await prisma.subscription.findUniqueOrThrow({
    where: { tenantId: session.tenantId },
  });
  const latestAccessEnd = cancellationAccessEnd(
    latestBeforeDelete.status,
    latestBeforeDelete.currentPeriodEnd,
    requestedAt,
  );
  if (latestAccessEnd && latestAccessEnd > (latestBeforeDelete.accessEndsAt ?? sub.accessEndsAt!)) {
    await prisma.subscription.update({
      where: { tenantId: session.tenantId },
      data: { accessEndsAt: latestAccessEnd },
    });
  }

  if (sub.gatewaySubscriptionId) await deleteSubscription(sub.gatewaySubscriptionId);

  // Re-read under lock after the network call so a payment webhook that landed
  // during cancellation can extend access without being overwritten.
  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<Pick<CancellationSnapshot, "id" | "status" | "currentPeriodEnd" | "accessEndsAt">>>`
      SELECT id::text AS id,
             status::text AS status,
             current_period_end AS "currentPeriodEnd",
             access_ends_at AS "accessEndsAt"
      FROM subscriptions
      WHERE tenant_id = ${session.tenantId}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) throw new HttpError(404, "NOT_FOUND", "Assinatura n\u00e3o encontrada.");

    const policyEnd = cancellationAccessEnd(current.status, current.currentPeriodEnd, requestedAt);
    const ends = [current.accessEndsAt, policyEnd].filter((date): date is Date => date !== null);
    const accessEndsAt = ends.reduce((latest, date) => date > latest ? date : latest);
    const trialCanceled = current.status === "TRIALING" || current.status === "PENDING_PAYMENT";
    return tx.subscription.update({
      where: { id: current.id },
      data: {
        ...(trialCanceled ? { status: "CANCELED" as const } : {}),
        accessEndsAt,
        cancellationConfirmed: true,
      },
    });
  });

  const state = cancellationState(updated.accessEndsAt, updated.cancellationConfirmed);
  const status = state === "SCHEDULED" ? "CANCELING" : "CANCELED";
  return ok({ status, accessEndsAt: updated.accessEndsAt });
});
