import { HttpError, ok, readJson, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { createCardSubscription, createCustomer, deleteSubscription } from "@/lib/billing/asaas";
import { needsPaymentSetup } from "@/lib/billing/access";
import { PLAN_MONTHLY_CENTS, PLAN_NAME, TRIAL_DAYS } from "@/lib/billing/plan";
import { addDays, localDateOf, zonedToUtc } from "@/lib/availability/tz";
import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/public/guard";
import { clientIp } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/schemas/subscription";

/**
 * Cadastra o cartão e cria a assinatura no Asaas com 7 dias grátis:
 * o cartão é validado agora e a primeira cobrança só sai no 8º dia.
 * Os dados do cartão passam por este servidor apenas para serem repassados ao Asaas:
 * NUNCA gravar nem registrar em log (ver AGENTS.md, seção 14).
 */
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

  // Reaproveita o cliente do Asaas se uma tentativa anterior falhou no meio do caminho.
  let customerId = sub.gatewayCustomerId;
  if (!customerId) {
    const customer = await createCustomer({
      name: input.holder.name,
      email: user.email,
      cpfCnpj: input.holder.cpfCnpj,
      externalReference: session.tenantId,
    });
    customerId = customer.id;
    await prisma.subscription.update({ where: { tenantId: session.tenantId }, data: { gatewayCustomerId: customerId } });
  }

  const firstChargeDate = addDays(localDateOf(new Date()), TRIAL_DAYS);
  const created = await createCardSubscription({
    customer: customerId,
    valueCents: PLAN_MONTHLY_CENTS,
    nextDueDate: firstChargeDate,
    description: PLAN_NAME,
    externalReference: session.tenantId,
    card: input.card,
    holder: { ...input.holder, email: user.email },
    remoteIp: clientIp(req),
  });

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  try {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { tenantId: session.tenantId },
        data: {
          status: "TRIALING",
          gatewaySubscriptionId: created.id,
          currentPeriodEnd: zonedToUtc(firstChargeDate, "00:00"),
        },
      }),
      prisma.tenant.update({ where: { id: session.tenantId }, data: { trialEndsAt } }),
    ]);
  } catch (err) {
    // Não deixa uma assinatura órfã cobrando um cliente que o sistema não reconhece.
    await deleteSubscription(created.id).catch(() => undefined);
    throw err;
  }

  return ok({ status: "TRIALING", trialEndsAt, firstChargeDate }, 201);
});
