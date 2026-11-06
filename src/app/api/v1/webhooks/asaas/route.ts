import type { Prisma } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError, ok, readJson, route } from "@/lib/api";
import { decide, subscriptionIdOf, type AsaasEvent } from "@/lib/billing/webhook-logic";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

const envelope = z.object({ id: z.string().min(1), event: z.string().min(1) }).passthrough();

function tokenMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook do Asaas. Regras: validar o token, ser idempotente pelo id do evento,
 * responder 2xx rápido (senão o Asaas reenvia e pode pausar a fila).
 */
export const POST = route(async (req: Request) => {
  const expected = getEnv().ASAAS_WEBHOOK_TOKEN;
  if (!expected) throw new HttpError(503, "BILLING_NOT_CONFIGURED", "Webhook não configurado");
  if (!tokenMatches(req.headers.get("asaas-access-token") ?? "", expected)) {
    throw new HttpError(401, "INVALID_TOKEN", "Token inválido");
  }

  const body = await readJson(req);
  const event = envelope.parse(body) as unknown as AsaasEvent;

  // Idempotência: um evento já processado é ignorado; um que falhou no meio é reprocessado.
  let record = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: "asaas", externalId: event.id } },
  });
  if (record?.processedAt) return ok({ duplicate: true });
  if (!record) {
    record = await prisma.webhookEvent.create({
      data: { provider: "asaas", externalId: event.id, payload: body as Prisma.InputJsonValue },
    });
  }

  const gatewaySubId = subscriptionIdOf(event);
  if (gatewaySubId) {
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionId: gatewaySubId } });
    if (sub) {
      const update = decide(event, { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd });
      if (update) await prisma.subscription.update({ where: { id: sub.id }, data: update });
    }
  }

  await prisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date() } });
  return ok({ received: true });
});
