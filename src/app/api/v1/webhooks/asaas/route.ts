import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError, ok, readJson, route } from "@/lib/api";
import { receiveAsaasWebhook } from "@/lib/billing/webhook-processor";
import type { AsaasEvent } from "@/lib/billing/webhook-logic";
import { getEnv } from "@/lib/env";
import type { Prisma } from "@prisma/client";

const envelope = z.object({ id: z.string().min(1), event: z.string().min(1) }).passthrough();

function tokenMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Authenticated Asaas events are durably stored before processing. */
export const POST = route(async (req: Request) => {
  const expected = getEnv().ASAAS_WEBHOOK_TOKEN;
  if (!expected) throw new HttpError(503, "BILLING_NOT_CONFIGURED", "Webhook n\u00e3o configurado");
  if (!tokenMatches(req.headers.get("asaas-access-token") ?? "", expected)) {
    throw new HttpError(401, "INVALID_TOKEN", "Token inv\u00e1lido");
  }

  const body = await readJson(req);
  const event = envelope.parse(body) as unknown as AsaasEvent;
  const result = await receiveAsaasWebhook(event, body as Prisma.InputJsonValue);
  return ok({
    received: true,
    duplicate: result === "DUPLICATE",
    pending: result === "PENDING",
  });
});
