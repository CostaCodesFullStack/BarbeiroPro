import { ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { PLAN_MONTHLY_CENTS, TRIAL_DAYS } from "@/lib/billing/plan";
import { prisma } from "@/lib/db";

/** Situação da assinatura da barbearia (somente o dono). */
export const GET = route(async () => {
  const session = await requireAuth("subscription:manage");

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.tenantId },
    select: {
      trialEndsAt: true,
      subscription: { select: { status: true, currentPeriodEnd: true, gatewaySubscriptionId: true } },
    },
  });

  return ok({
    status: tenant.subscription?.status ?? null,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEnd: tenant.subscription?.currentPeriodEnd ?? null,
    hasGateway: Boolean(tenant.subscription?.gatewaySubscriptionId),
    priceCents: PLAN_MONTHLY_CENTS,
    trialDays: TRIAL_DAYS,
  });
});
