import { ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { PLAN_MONTHLY_CENTS, TRIAL_DAYS } from "@/lib/billing/plan";
import { cancellationState } from "@/lib/billing/cancellation";
import { prisma } from "@/lib/db";

/** Situação da assinatura da barbearia (somente o dono). */
export const GET = route(async () => {
  const session = await requireAuth("subscription:manage");

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.tenantId },
    select: {
      trialEndsAt: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          accessEndsAt: true,
          cancellationConfirmed: true,
          gatewaySubscriptionId: true,
        },
      },
    },
  });

  const subscription = tenant.subscription;
  const cancelState = cancellationState(
    subscription?.accessEndsAt ?? null,
    subscription?.cancellationConfirmed ?? false,
  );
  const status = cancelState === "SCHEDULED"
    ? "CANCELING"
    : cancelState === "ENDED"
      ? "CANCELED"
      : subscription?.status ?? null;

  return ok({
    status,
    cancelState,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    accessEndsAt: subscription?.accessEndsAt ?? null,
    cancellationConfirmed: subscription?.cancellationConfirmed ?? false,
    hasGateway: Boolean(subscription?.gatewaySubscriptionId),
    priceCents: PLAN_MONTHLY_CENTS,
    trialDays: TRIAL_DAYS,
  });
});
