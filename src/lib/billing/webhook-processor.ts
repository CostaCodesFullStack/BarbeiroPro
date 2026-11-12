import { Prisma } from "@prisma/client";
import { getPayment } from "@/lib/billing/asaas";
import { prisma } from "@/lib/db";
import { decide, subscriptionIdOf, type AsaasEvent } from "./webhook-logic";

type ProcessResult = "PROCESSED" | "DUPLICATE" | "PENDING";

type LockedEvent = {
  id: string;
  processedAt: Date | null;
  payload: Prisma.JsonValue;
};

type LockedSubscription = {
  id: string;
  status: "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  currentPeriodEnd: Date | null;
  accessEndsAt: Date | null;
  cancellationConfirmed: boolean;
};

function isPaidEvent(event: AsaasEvent): boolean {
  return event.event === "PAYMENT_CONFIRMED" || event.event === "PAYMENT_RECEIVED";
}

function isSubscriptionEvent(event: AsaasEvent): boolean {
  return event.event.startsWith("SUBSCRIPTION_");
}

function isPaymentEvent(event: AsaasEvent): boolean {
  return event.event.startsWith("PAYMENT_");
}

function isValidDueDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * A paid event without a date is not enough to activate or renew a subscription.
 * Retrieve the payment once and accept only matching, confirmed gateway data.
 */
async function resolvePaidEvent(event: AsaasEvent): Promise<{ event: AsaasEvent; pending: boolean }> {
  if (!isPaidEvent(event)) return { event, pending: false };

  const paymentId = event.payment?.id;
  const knownSubscriptionId = subscriptionIdOf(event);
  if (isValidDueDate(event.payment?.dueDate) && knownSubscriptionId) return { event, pending: false };
  if (!paymentId) return { event, pending: true };

  try {
    const payment = await getPayment(paymentId);
    if (payment.id !== paymentId) return { event, pending: true };
    if (payment.status !== "CONFIRMED" && payment.status !== "RECEIVED") return { event, pending: true };
    if (knownSubscriptionId && payment.subscription && knownSubscriptionId !== payment.subscription) {
      return { event, pending: true };
    }

    // A payment with no recurring subscription is unrelated to subscription state.
    if (!knownSubscriptionId && !payment.subscription) return { event, pending: false };
    const resolvedSubscriptionId = knownSubscriptionId ?? payment.subscription ?? null;
    const dueDate = isValidDueDate(event.payment?.dueDate) ? event.payment?.dueDate : payment.dueDate;
    if (!resolvedSubscriptionId || !isValidDueDate(dueDate)) return { event, pending: true };

    return {
      event: {
        ...event,
        payment: { ...event.payment, id: paymentId, subscription: resolvedSubscriptionId, dueDate },
      },
      pending: false,
    };
  } catch {
    return { event, pending: true };
  }
}

/** Persisted events are row-locked; subscription changes and processedAt commit atomically. */
export async function processAsaasWebhookEvent(eventId: string): Promise<ProcessResult> {
  const stored = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (!stored) return "PENDING";
  if (stored.processedAt) return "DUPLICATE";

  const original = stored.payload as unknown as AsaasEvent;
  const resolved = await resolvePaidEvent(original);
  if (resolved.pending) return "PENDING";
  const event = resolved.event;

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedEvent[]>`
      SELECT id::text AS id, processed_at AS "processedAt", payload
      FROM webhook_events
      WHERE id = ${eventId}::uuid
      FOR UPDATE
    `;
    const currentEvent = rows[0];
    if (!currentEvent) return "PENDING";
    if (currentEvent.processedAt) return "DUPLICATE";

    const latestPayload = currentEvent.payload as unknown as AsaasEvent;
    // If another retry already stored more complete gateway data, never replace
    // it with an older request body.
    const latestSubscriptionId = subscriptionIdOf(latestPayload);
    const resolvedSubscriptionId = subscriptionIdOf(event);
    const eventToApply = latestSubscriptionId && resolvedSubscriptionId && latestSubscriptionId !== resolvedSubscriptionId
      ? latestPayload
      : {
          ...latestPayload,
          ...event,
          payment: {
            ...latestPayload.payment,
            ...event.payment,
            subscription: latestPayload.payment?.subscription ?? event.payment?.subscription,
            dueDate: isValidDueDate(latestPayload.payment?.dueDate)
              ? latestPayload.payment.dueDate
              : event.payment?.dueDate,
          },
          subscription: latestPayload.subscription ?? event.subscription,
        };
    if (JSON.stringify(eventToApply) !== JSON.stringify(latestPayload)) {
      await tx.webhookEvent.update({
        where: { id: eventId },
        data: { payload: eventToApply as unknown as Prisma.InputJsonValue },
      });
    }

    const gatewaySubscriptionId = subscriptionIdOf(eventToApply);
    if (!gatewaySubscriptionId) {
      if (isSubscriptionEvent(eventToApply)) return "PENDING";
      // Payment events with no subscription are one-off payments; unrelated
      // event types are acknowledged without touching subscription state.
      if (isPaymentEvent(eventToApply) || !isSubscriptionEvent(eventToApply)) {
        await tx.webhookEvent.update({ where: { id: eventId }, data: { processedAt: new Date() } });
        return "PROCESSED";
      }
      return "PENDING";
    }

    const subscriptions = await tx.$queryRaw<LockedSubscription[]>`
      SELECT id::text AS id,
             status::text AS status,
             current_period_end AS "currentPeriodEnd",
             access_ends_at AS "accessEndsAt",
             cancellation_confirmed AS "cancellationConfirmed"
      FROM subscriptions
      WHERE gateway_subscription_id = ${gatewaySubscriptionId}
      FOR UPDATE
    `;
    // A missing or ambiguous mapping stays durable for later reconciliation.
    if (subscriptions.length !== 1) return "PENDING";

    const subscription = subscriptions[0];
    const update = decide(eventToApply, subscription);
    if (update) {
      await tx.subscription.update({ where: { id: subscription.id }, data: update });
    }
    await tx.webhookEvent.update({ where: { id: eventId }, data: { processedAt: new Date() } });
    return "PROCESSED";
  });
}

export async function receiveAsaasWebhook(event: AsaasEvent, payload: Prisma.InputJsonValue) {
  const uniqueKey = { provider_externalId: { provider: "asaas", externalId: event.id } };
  let record;
  try {
    record = await prisma.webhookEvent.upsert({
      where: uniqueKey,
      create: { provider: "asaas", externalId: event.id, payload },
      update: {},
    });
  } catch (error) {
    // PostgreSQL may reject one of two simultaneous first deliveries before
    // Prisma's upsert reaches its update branch. Reuse the winning durable row.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await prisma.webhookEvent.findUnique({ where: uniqueKey });
    if (!existing) throw error;
    record = existing;
  }
  return processAsaasWebhookEvent(record.id);
}

/** Reprocess pending webhooks after checkout binds the remote subscription to its tenant. */
export async function processPendingAsaasEventsForSubscription(gatewaySubscriptionId: string): Promise<void> {
  const pending = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM webhook_events
    WHERE provider = 'asaas'
      AND processed_at IS NULL
      AND (
        payload->'payment'->>'subscription' = ${gatewaySubscriptionId}
        OR payload->'subscription'->>'id' = ${gatewaySubscriptionId}
      )
    ORDER BY created_at, id
    LIMIT 100
  `;

  for (const row of pending) await processAsaasWebhookEvent(row.id);
}
