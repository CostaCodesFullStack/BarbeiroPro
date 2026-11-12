import { HttpError, ok, readJson, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import {
  createCardSubscription,
  createCustomer,
  findCustomersByExternalReference,
  findSubscriptionsByExternalReference,
  type AsaasSubscription,
} from "@/lib/billing/asaas";
import { needsPaymentSetup } from "@/lib/billing/access";
import { checkoutRecoveryAction, isDefinitiveCheckoutDecline, type CheckoutAttemptStatus } from "@/lib/billing/checkout-recovery";
import {
  CUSTOMER_CHECKING,
  CUSTOMER_IN_FLIGHT,
  CUSTOMER_RECONCILIATION_REQUIRED,
  ensureCustomerForCheckout,
  type CustomerCheckoutStore,
} from "@/lib/billing/customer-recovery";
import { PLAN_MONTHLY_CENTS, PLAN_NAME } from "@/lib/billing/plan";
import { processPendingAsaasEventsForSubscription } from "@/lib/billing/webhook-processor";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { enforceRateLimit } from "@/lib/public/guard";
import { clientIp } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/schemas/subscription";
import { trialSchedule } from "@/lib/billing/trial";
import { zonedToUtc } from "@/lib/availability/tz";

type CheckoutSnapshot = {
  id: string;
  status: string;
  gatewayCustomerId: string | null;
  gatewaySubscriptionId: string | null;
  accessEndsAt: Date | null;
  cancellationConfirmed: boolean;
  checkoutReference: string | null;
  checkoutStatus: CheckoutAttemptStatus | null;
  checkoutFirstChargeDate: string | null;
};

const CHECKOUT_PENDING_MESSAGE =
  "Ainda não conseguimos confirmar o resultado da ativação. Não envie os dados do cartão novamente; tente consultar novamente em alguns minutos ou fale com o suporte.";
const CHECKOUT_RECONCILIATION_MESSAGE =
  "Encontramos mais de um resultado possível para esta ativação. Nenhuma nova assinatura foi criada; fale com o suporte para conferirmos o Asaas.";

async function lockedSnapshot(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<CheckoutSnapshot | null> {
  const rows = await tx.$queryRaw<CheckoutSnapshot[]>`
    SELECT id::text AS id,
           status::text AS status,
           gateway_customer_id AS "gatewayCustomerId",
           gateway_subscription_id AS "gatewaySubscriptionId",
           access_ends_at AS "accessEndsAt",
           cancellation_confirmed AS "cancellationConfirmed",
           checkout_reference AS "checkoutReference",
           checkout_status AS "checkoutStatus",
           checkout_first_charge_date AS "checkoutFirstChargeDate"
    FROM subscriptions
    WHERE tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/** Reserve customer recovery before any remote customer POST. */
function customerCheckoutStore(tenantId: string): CustomerCheckoutStore {
  return {
    reserve: async () => prisma.$transaction(async (tx) => {
      const row = await lockedSnapshot(tx, tenantId);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Assinatura não encontrada.");
      if (row.gatewaySubscriptionId) {
        throw new HttpError(409, "ALREADY_SUBSCRIBED", "Esta barbearia já possui uma assinatura.");
      }
      if (row.status !== "PENDING_PAYMENT" && row.status !== "TRIALING") {
        throw new HttpError(409, "CHECKOUT_UNAVAILABLE", "Esta assinatura não pode iniciar um novo checkout.");
      }
      if (row.accessEndsAt || row.cancellationConfirmed) {
        throw new HttpError(409, "CHECKOUT_UNAVAILABLE", "O cancelamento desta assinatura já foi solicitado.");
      }
      if (row.gatewayCustomerId) {
        return { customerId: row.gatewayCustomerId, status: row.checkoutStatus };
      }

      if (!row.checkoutStatus || row.checkoutStatus === "FAILED") {
        await tx.$executeRaw`
          UPDATE subscriptions
          SET checkout_reference = COALESCE(checkout_reference, ${tenantId}),
              checkout_status = ${CUSTOMER_CHECKING},
              checkout_first_charge_date = NULL,
              updated_at = NOW()
          WHERE id = ${row.id}::uuid
        `;
        return { customerId: null, status: CUSTOMER_CHECKING };
      }
      return { customerId: null, status: row.checkoutStatus };
    }),
    claimCreate: async () => prisma.$transaction(async (tx) => {
      const row = await lockedSnapshot(tx, tenantId);
      if (
        !row ||
        row.gatewayCustomerId ||
        row.gatewaySubscriptionId ||
        row.accessEndsAt ||
        row.cancellationConfirmed ||
        (row.status !== "PENDING_PAYMENT" && row.status !== "TRIALING") ||
        row.checkoutStatus !== CUSTOMER_CHECKING
      ) return false;

      const changed = await tx.$executeRaw`
        UPDATE subscriptions
        SET checkout_status = ${CUSTOMER_IN_FLIGHT},
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
          AND checkout_status = ${CUSTOMER_CHECKING}
          AND gateway_customer_id IS NULL
          AND gateway_subscription_id IS NULL
      `;
      return changed === 1;
    }),
    persist: async (customerId) => prisma.$transaction(async (tx) => {
      const row = await lockedSnapshot(tx, tenantId);
      if (!row) throw new HttpError(404, "NOT_FOUND", "Assinatura não encontrada.");
      if (
        row.gatewaySubscriptionId ||
        row.accessEndsAt ||
        row.cancellationConfirmed ||
        (row.gatewayCustomerId && row.gatewayCustomerId !== customerId)
      ) return "CONFLICT";
      if (row.status !== "PENDING_PAYMENT" && row.status !== "TRIALING") {
        throw new HttpError(409, "CHECKOUT_UNAVAILABLE", "Esta assinatura não pode iniciar um novo checkout.");
      }

      const changed = await tx.$executeRaw`
        UPDATE subscriptions
        SET gateway_customer_id = ${customerId},
            checkout_reference = COALESCE(checkout_reference, ${tenantId}),
            checkout_status = 'CHECKING',
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
          AND gateway_subscription_id IS NULL
          AND (gateway_customer_id IS NULL OR gateway_customer_id = ${customerId})
      `;
      return changed === 1 ? "SAVED" : "CONFLICT";
    }),
    markReconciliationRequired: () => updateCheckoutStatus(tenantId, CUSTOMER_RECONCILIATION_REQUIRED),
    markFailed: () => updateCheckoutStatus(tenantId, "FAILED"),
  };
}

/** Persist a durable per-tenant reservation before any subscription POST. */
async function reserveCheckout(tenantId: string): Promise<CheckoutSnapshot> {
  return prisma.$transaction(async (tx) => {
    const row = await lockedSnapshot(tx, tenantId);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Assinatura não encontrada.");
    if (row.status !== "PENDING_PAYMENT" && row.status !== "TRIALING") {
      throw new HttpError(409, "CHECKOUT_UNAVAILABLE", "Esta assinatura não pode iniciar um novo checkout.");
    }
    if (row.accessEndsAt || row.cancellationConfirmed) {
      throw new HttpError(409, "CHECKOUT_UNAVAILABLE", "O cancelamento desta assinatura já foi solicitado.");
    }
    if (row.gatewaySubscriptionId) return row;

    if (!row.checkoutStatus || row.checkoutStatus === "FAILED") {
      await tx.$executeRaw`
        UPDATE subscriptions
        SET checkout_reference = COALESCE(checkout_reference, ${tenantId}),
            checkout_status = 'CHECKING',
            checkout_first_charge_date = NULL,
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
      `;
      return {
        ...row,
        checkoutReference: row.checkoutReference ?? tenantId,
        checkoutStatus: "CHECKING",
        checkoutFirstChargeDate: null,
      };
    }
    return row;
  });
}

async function updateCheckoutStatus(
  tenantId: string,
  status: CheckoutAttemptStatus,
  firstChargeDate?: string | null,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE subscriptions
    SET checkout_status = ${status},
        checkout_first_charge_date = COALESCE(${firstChargeDate ?? null}, checkout_first_charge_date),
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}::uuid
      AND gateway_subscription_id IS NULL
  `;
}

async function claimAsaasCreation(tenantId: string, firstChargeDate: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const row = await lockedSnapshot(tx, tenantId);
    if (
      !row ||
      row.gatewaySubscriptionId ||
      row.accessEndsAt ||
      row.cancellationConfirmed ||
      (row.status !== "PENDING_PAYMENT" && row.status !== "TRIALING")
    ) return false;
    if (row.checkoutStatus !== "CHECKING") return false;

    const changed = await tx.$executeRaw`
      UPDATE subscriptions
      SET checkout_status = 'IN_FLIGHT',
          checkout_first_charge_date = ${firstChargeDate},
          updated_at = NOW()
      WHERE id = ${row.id}::uuid
        AND checkout_status = 'CHECKING'
        AND gateway_subscription_id IS NULL
    `;
    return changed === 1;
  });
}

async function markReconciliationRequired(tenantId: string): Promise<void> {
  await updateCheckoutStatus(tenantId, "RECONCILIATION_REQUIRED");
}

async function finishCheckout(
  tenantId: string,
  gatewaySubscriptionId: string,
  firstChargeDate: string,
  externalReference: string,
): Promise<Date> {
  const trialEndsAt = zonedToUtc(firstChargeDate, "00:00");

  await prisma.$transaction(async (tx) => {
    const current = await lockedSnapshot(tx, tenantId);
    if (!current) throw new HttpError(404, "NOT_FOUND", "Assinatura não encontrada.");
    if (current.status === "CANCELED" || current.accessEndsAt || current.cancellationConfirmed) {
      throw new HttpError(409, "CHECKOUT_UNAVAILABLE", "A assinatura foi cancelada durante a ativação.");
    }
    if (current.gatewaySubscriptionId && current.gatewaySubscriptionId !== gatewaySubscriptionId) {
      throw new HttpError(409, "CHECKOUT_RECONCILIATION_REQUIRED", CHECKOUT_RECONCILIATION_MESSAGE);
    }

    await tx.subscription.update({
      where: { tenantId },
      data: {
        status: "TRIALING",
        gatewaySubscriptionId,
        currentPeriodEnd: trialEndsAt,
        accessEndsAt: null,
        cancellationConfirmed: false,
      },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { trialEndsAt } });
    await tx.$executeRaw`
      UPDATE subscriptions
      SET checkout_reference = ${externalReference},
          checkout_status = 'COMPLETE',
          checkout_first_charge_date = ${firstChargeDate},
          updated_at = NOW()
      WHERE tenant_id = ${tenantId}::uuid
    `;
  });

  // Linking the subscription is already committed. Keep checkout successful
  // if later event reconciliation is temporarily unavailable; events remain pending.
  await processPendingAsaasEventsForSubscription(gatewaySubscriptionId).catch(() => undefined);
  return trialEndsAt;
}

function isActiveRemoteSubscription(candidate: AsaasSubscription, reference: string): boolean {
  return candidate.externalReference === reference && candidate.deleted !== true && candidate.status === "ACTIVE";
}

async function lookupRemoteSubscriptions(reference: string) {
  const result = await findSubscriptionsByExternalReference(reference);
  const data = result.data.filter((entry) => entry.externalReference === reference);
  return { data, complete: result.hasMore !== true };
}

function pendingError(): HttpError {
  return new HttpError(409, "CHECKOUT_PENDING", CHECKOUT_PENDING_MESSAGE);
}

export const POST = route(async (req: Request) => {
  const session = await requireAuth("subscription:manage");
  enforceRateLimit(`checkout:${session.tenantId}`, 5, 3_600_000);

  const input = checkoutSchema.parse(await readJson(req));
  const sub = await prisma.subscription.findUnique({ where: { tenantId: session.tenantId } });
  if (!sub) throw new HttpError(404, "NOT_FOUND", "Assinatura não encontrada");
  if (!needsPaymentSetup({ status: sub.status, hasGateway: Boolean(sub.gatewaySubscriptionId) })) {
    throw new HttpError(409, "ALREADY_SUBSCRIBED", "Esta barbearia já possui uma assinatura.");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { email: true },
  });

  // Reuse or recover one tenant-scoped customer before the serialized subscription flow.
  const customer = await ensureCustomerForCheckout(
    session.tenantId,
    customerCheckoutStore(session.tenantId),
    {
      findByExternalReference: findCustomersByExternalReference,
      create: () => createCustomer({
        name: input.holder.name,
        email: user.email,
        cpfCnpj: input.holder.cpfCnpj,
        externalReference: session.tenantId,
      }),
    },
  );
  if (customer.kind === "pending") throw pendingError();
  if (customer.kind === "reconcile") {
    throw new HttpError(409, "CHECKOUT_RECONCILIATION_REQUIRED", CHECKOUT_RECONCILIATION_MESSAGE);
  }
  const customerId = customer.customerId;

  let attempt = await reserveCheckout(session.tenantId);
  if (attempt.gatewaySubscriptionId) {
    throw new HttpError(409, "ALREADY_SUBSCRIBED", "Esta barbearia já possui uma assinatura.");
  }

  const externalReference = attempt.checkoutReference ?? session.tenantId;
  let remote;
  try {
    remote = await lookupRemoteSubscriptions(externalReference);
  } catch {
    throw pendingError();
  }

  const action = checkoutRecoveryAction({
    status: attempt.checkoutStatus,
    hasLocalSubscription: false,
    remoteCount: remote.data.length,
    remoteListComplete: remote.complete,
    ownsCreateClaim: false,
  });

  if (action === "RECONCILE") {
    await markReconciliationRequired(session.tenantId);
    throw new HttpError(409, "CHECKOUT_RECONCILIATION_REQUIRED", CHECKOUT_RECONCILIATION_MESSAGE);
  }

  if (action === "RECOVER") {
    const candidate = remote.data[0];
    if (!candidate || !isActiveRemoteSubscription(candidate, externalReference) || !attempt.checkoutFirstChargeDate) {
      await markReconciliationRequired(session.tenantId);
      throw new HttpError(409, "CHECKOUT_RECONCILIATION_REQUIRED", CHECKOUT_RECONCILIATION_MESSAGE);
    }
    const trialEndsAt = await finishCheckout(
      session.tenantId,
      candidate.id,
      attempt.checkoutFirstChargeDate,
      externalReference,
    );
    const latest = await prisma.subscription.findUniqueOrThrow({
      where: { tenantId: session.tenantId },
      select: { status: true },
    });
    return ok({ status: latest.status, trialEndsAt, firstChargeDate: attempt.checkoutFirstChargeDate, recovered: true });
  }

  if (action === "PENDING" && attempt.checkoutStatus === "CHECKING" && remote.data.length === 0 && remote.complete) {
    // The reservation is durable, but only one retry may move it into the
    // network-call state. Other simultaneous requests remain pending.
    const schedule = trialSchedule(new Date());
    const ownsCreateClaim = await claimAsaasCreation(session.tenantId, schedule.firstChargeDate);
    const createAction = checkoutRecoveryAction({
      status: attempt.checkoutStatus,
      hasLocalSubscription: false,
      remoteCount: 0,
      remoteListComplete: true,
      ownsCreateClaim,
    });
    if (createAction === "CREATE") {
      attempt = { ...attempt, checkoutStatus: "IN_FLIGHT", checkoutFirstChargeDate: schedule.firstChargeDate };
      try {
        const created = await createCardSubscription({
          customer: customerId,
          valueCents: PLAN_MONTHLY_CENTS,
          nextDueDate: schedule.firstChargeDate,
          description: PLAN_NAME,
          externalReference,
          card: input.card,
          holder: { ...input.holder, email: user.email },
          remoteIp: clientIp(req),
        });
        if (!created?.id) {
          await updateCheckoutStatus(session.tenantId, "UNKNOWN").catch(() => undefined);
          throw pendingError();
        }
        const trialEndsAt = await finishCheckout(session.tenantId, created.id, schedule.firstChargeDate, externalReference);
        const latest = await prisma.subscription.findUniqueOrThrow({
          where: { tenantId: session.tenantId },
          select: { status: true },
        });
        return ok({ status: latest.status, trialEndsAt, firstChargeDate: schedule.firstChargeDate, recovered: false }, 201);
      } catch (err) {
        if (err instanceof HttpError && err.code === "CHECKOUT_PENDING") throw err;
        if (isDefinitiveCheckoutDecline(err)) {
          await updateCheckoutStatus(session.tenantId, "FAILED").catch(() => undefined);
          throw err;
        }
        // The remote POST may have succeeded even if the response or local
        // persistence failed. Never send another POST without reconciliation.
        await updateCheckoutStatus(session.tenantId, "UNKNOWN").catch(() => undefined);
        throw pendingError();
      }
    }
  }

  // A prior POST may have reached Asaas despite a timeout. Keep it pending until
  // a later lookup finds exactly one matching subscription.
  if (attempt.checkoutStatus === "IN_FLIGHT") {
    await updateCheckoutStatus(session.tenantId, "UNKNOWN").catch(() => undefined);
  }
  throw pendingError();
});
