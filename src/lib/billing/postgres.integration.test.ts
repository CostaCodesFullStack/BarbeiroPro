import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, SubscriptionStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createCustomer: vi.fn(),
  findCustomersByExternalReference: vi.fn(),
  createCardSubscription: vi.fn(),
  findSubscriptionsByExternalReference: vi.fn(),
  deleteSubscription: vi.fn(),
  getPayment: vi.fn(),
  sessions: [] as Array<{ userId: string; tenantId: string; role: string }>,
  customers: new Map<string, Array<{ id: string; externalReference: string }>>(),
  subscriptions: new Map<string, Array<Record<string, unknown>>>(),
}));

vi.mock("@/lib/auth/guard", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/billing/asaas", () => ({
  createCustomer: mocks.createCustomer,
  findCustomersByExternalReference: mocks.findCustomersByExternalReference,
  createCardSubscription: mocks.createCardSubscription,
  findSubscriptionsByExternalReference: mocks.findSubscriptionsByExternalReference,
  deleteSubscription: mocks.deleteSubscription,
  getPayment: mocks.getPayment,
}));

import { POST as checkoutPost } from "@/app/api/v1/subscription/checkout/route";
import { POST as cancelPost } from "@/app/api/v1/subscription/cancel/route";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { receiveAsaasWebhook } from "./webhook-processor";
import type { AsaasEvent } from "./webhook-logic";

type Fixture = { tenantId: string; userId: string };
type RemoteSubscriptionInput = { customer: string; externalReference: string; nextDueDate: string };
type FixtureOptions = {
  status?: SubscriptionStatus;
  gatewayCustomerId?: string | null;
  gatewaySubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  checkoutStatus?: string | null;
};

const enabled = Boolean(process.env.DATABASE_URL);
const tenantIds: string[] = [];
const userIds: string[] = [];
const webhookExternalIds: string[] = [];

function addRemoteCustomer(externalReference: string) {
  const customer = { id: `cus_it_${randomUUID()}`, externalReference };
  const existing = mocks.customers.get(externalReference) ?? [];
  existing.push(customer);
  mocks.customers.set(externalReference, existing);
  return customer;
}

function addRemoteSubscription(input: RemoteSubscriptionInput) {
  const subscription = {
    id: `sub_it_${randomUUID()}`,
    externalReference: input.externalReference,
    customer: input.customer,
    nextDueDate: input.nextDueDate,
    status: "ACTIVE",
    deleted: false,
  };
  const existing = mocks.subscriptions.get(input.externalReference) ?? [];
  existing.push(subscription);
  mocks.subscriptions.set(input.externalReference, existing);
  return subscription;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function createFixture(options: FixtureOptions = {}): Promise<Fixture> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const tenant = await prisma.tenant.create({
    data: {
      name: `Billing integration ${suffix}`,
      slug: `billing-it-${suffix}`,
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  tenantIds.push(tenant.id);

  const user = await prisma.user.create({
    data: {
      name: `Billing test ${suffix}`,
      email: `billing-it-${suffix}@example.invalid`,
      passwordHash: "integration-test-only",
    },
  });
  userIds.push(user.id);

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      status: options.status ?? "PENDING_PAYMENT",
      gatewayCustomerId: options.gatewayCustomerId ?? null,
      gatewaySubscriptionId: options.gatewaySubscriptionId ?? null,
      currentPeriodEnd: options.currentPeriodEnd ?? null,
      checkoutStatus: options.checkoutStatus ?? null,
    },
  });

  return { tenantId: tenant.id, userId: user.id };
}

function queueSessions(...fixtures: Fixture[]) {
  mocks.sessions.push(...fixtures.map(({ tenantId, userId }) => ({ tenantId, userId, role: "OWNER" })));
}

function checkoutRequest() {
  return new Request("http://localhost/api/v1/subscription/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      card: {
        holderName: "Teste de Integração",
        number: "4242424242424242",
        expiryMonth: "12",
        expiryYear: "2030",
        ccv: "123",
      },
      holder: {
        name: "Teste de Integração",
        cpfCnpj: "52998224725",
        postalCode: "01310100",
        addressNumber: "123",
        phone: "11999999999",
      },
    }),
  });
}

async function responseBody(response: Response) {
  return response.json() as Promise<{ data?: Record<string, unknown>; error?: { code: string } }>;
}

describe.skipIf(!enabled)("billing no PostgreSQL local com Asaas mockado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions.length = 0;
    mocks.customers.clear();
    mocks.subscriptions.clear();

    mocks.requireAuth.mockImplementation(async () => {
      const session = mocks.sessions.shift();
      if (!session) throw new Error("Sessão de fixture não configurada");
      return session;
    });
    mocks.createCustomer.mockImplementation(async ({ externalReference }: { externalReference: string }) =>
      addRemoteCustomer(externalReference),
    );
    mocks.findCustomersByExternalReference.mockImplementation(async (externalReference: string) => ({
      data: [...(mocks.customers.get(externalReference) ?? [])],
      hasMore: false,
    }));
    mocks.createCardSubscription.mockImplementation(async (input: RemoteSubscriptionInput) => addRemoteSubscription(input));
    mocks.findSubscriptionsByExternalReference.mockImplementation(async (externalReference: string) => ({
      data: [...(mocks.subscriptions.get(externalReference) ?? [])],
      hasMore: false,
    }));
    mocks.deleteSubscription.mockResolvedValue({ deleted: true });
    mocks.getPayment.mockRejectedValue(new Error("Teste não permite chamadas externas ao Asaas"));
  });

  afterAll(async () => {
    if (webhookExternalIds.length) {
      await prisma.webhookEvent.deleteMany({
        where: { provider: "asaas", externalId: { in: webhookExternalIds } },
      });
    }
    if (tenantIds.length) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("faz um único claim de customer em checkouts concorrentes do mesmo tenant", async () => {
    const fixture = await createFixture();
    queueSessions(fixture, fixture);
    const started = deferred();
    const release = deferred();
    mocks.createCustomer.mockImplementation(async ({ externalReference }: { externalReference: string }) => {
      started.resolve();
      await release.promise;
      return addRemoteCustomer(externalReference);
    });

    const first = checkoutPost(checkoutRequest());
    await started.promise;
    const second = await checkoutPost(checkoutRequest());
    release.resolve();
    const firstResponse = await first;

    expect(firstResponse.status).toBe(201);
    expect(second.status).toBe(409);
    expect((await responseBody(second)).error?.code).toBe("CHECKOUT_PENDING");
    expect(mocks.createCustomer).toHaveBeenCalledTimes(1);
    expect(mocks.createCardSubscription).toHaveBeenCalledTimes(1);

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    const customer = mocks.customers.get(fixture.tenantId)?.[0];
    expect(persisted.gatewayCustomerId).toBe(customer?.id);
    expect(persisted.gatewaySubscriptionId).toBe(mocks.subscriptions.get(fixture.tenantId)?.[0]?.id);
    expect(persisted.checkoutStatus).toBe("COMPLETE");
  });

  it("isola customers e assinaturas em checkouts concorrentes de tenants diferentes", async () => {
    const firstFixture = await createFixture();
    const secondFixture = await createFixture();
    queueSessions(firstFixture, secondFixture);

    const [firstResponse, secondResponse] = await Promise.all([
      checkoutPost(checkoutRequest()),
      checkoutPost(checkoutRequest()),
    ]);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(mocks.createCustomer).toHaveBeenCalledTimes(2);
    expect(mocks.createCardSubscription).toHaveBeenCalledTimes(2);

    for (const fixture of [firstFixture, secondFixture]) {
      const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
      const customer = mocks.customers.get(fixture.tenantId)?.[0];
      const remoteSubscription = mocks.subscriptions.get(fixture.tenantId)?.[0];
      expect(persisted.gatewayCustomerId).toBe(customer?.id);
      expect(persisted.gatewaySubscriptionId).toBe(remoteSubscription?.id);
      expect(remoteSubscription?.customer).toBe(customer?.id);
    }
  });

  it("reutiliza customer persistido sem criar ou buscar outro customer", async () => {
    const fixture = await createFixture({ gatewayCustomerId: "cus_existing_for_test" });
    queueSessions(fixture);

    const response = await checkoutPost(checkoutRequest());

    expect(response.status).toBe(201);
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.findCustomersByExternalReference).not.toHaveBeenCalled();
    expect(mocks.createCardSubscription).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_existing_for_test",
      externalReference: fixture.tenantId,
    }));
  });

  it("recupera customer e assinatura após respostas remotas incertas sem repetir POSTs", async () => {
    const fixture = await createFixture();
    queueSessions(fixture, fixture, fixture);
    let customerAttempts = 0;
    let subscriptionAttempts = 0;
    mocks.createCustomer.mockImplementation(async ({ externalReference }: { externalReference: string }) => {
      const customer = addRemoteCustomer(externalReference);
      if (++customerAttempts === 1) throw new Error("timeout após customer remoto");
      return customer;
    });
    mocks.createCardSubscription.mockImplementation(async (input: RemoteSubscriptionInput) => {
      const subscription = addRemoteSubscription(input);
      if (++subscriptionAttempts === 1) throw new Error("timeout após assinatura remota");
      return subscription;
    });

    const customerTimeout = await checkoutPost(checkoutRequest());
    const subscriptionTimeout = await checkoutPost(checkoutRequest());
    const recovered = await checkoutPost(checkoutRequest());

    expect(customerTimeout.status).toBe(409);
    expect(subscriptionTimeout.status).toBe(409);
    expect(recovered.status).toBe(200);
    expect((await responseBody(recovered)).data?.recovered).toBe(true);
    expect(mocks.createCustomer).toHaveBeenCalledTimes(1);
    expect(mocks.createCardSubscription).toHaveBeenCalledTimes(1);

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.gatewayCustomerId).toBe(mocks.customers.get(fixture.tenantId)?.[0]?.id);
    expect(persisted.gatewaySubscriptionId).toBe(mocks.subscriptions.get(fixture.tenantId)?.[0]?.id);
    expect(persisted.status).toBe("TRIALING");
  });

  it("libera nova tentativa após recusa definitiva antes da criação do customer", async () => {
    const fixture = await createFixture();
    queueSessions(fixture, fixture);
    mocks.createCustomer
      .mockRejectedValueOnce(new HttpError(402, "PAYMENT_REFUSED", "Recusa simulada antes da criação"))
      .mockImplementationOnce(async ({ externalReference }: { externalReference: string }) =>
        addRemoteCustomer(externalReference),
      );

    const declined = await checkoutPost(checkoutRequest());
    const retried = await checkoutPost(checkoutRequest());

    expect(declined.status).toBe(402);
    expect(retried.status).toBe(201);
    expect(mocks.createCustomer).toHaveBeenCalledTimes(2);
    expect(mocks.createCardSubscription).toHaveBeenCalledTimes(1);
    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.gatewayCustomerId).toBe(mocks.customers.get(fixture.tenantId)?.[0]?.id);
    expect(persisted.checkoutStatus).toBe("COMPLETE");
  });

  it("bloqueia cancelamento enquanto a criação remota da assinatura está em voo", async () => {
    const fixture = await createFixture();
    queueSessions(fixture, fixture);
    const started = deferred();
    const release = deferred();
    mocks.createCardSubscription.mockImplementation(async (input: RemoteSubscriptionInput) => {
      const subscription = addRemoteSubscription(input);
      started.resolve();
      await release.promise;
      return subscription;
    });

    const checkout = checkoutPost(checkoutRequest());
    await started.promise;
    const cancellation = await cancelPost();
    release.resolve();
    const completedCheckout = await checkout;

    expect(cancellation.status).toBe(409);
    expect((await responseBody(cancellation)).error?.code).toBe("CHECKOUT_PENDING");
    expect(completedCheckout.status).toBe(201);
    expect(mocks.deleteSubscription).not.toHaveBeenCalled();

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.status).toBe("TRIALING");
    expect(persisted.cancellationConfirmed).toBe(false);
  });

  it("mantém webhook anterior ao vínculo pendente e processa após o checkout gravar o ID", async () => {
    const fixture = await createFixture();
    queueSessions(fixture);
    const started = deferred();
    const release = deferred();
    let remoteId = "";
    mocks.createCardSubscription.mockImplementation(async (input: RemoteSubscriptionInput) => {
      const subscription = addRemoteSubscription(input);
      remoteId = subscription.id as string;
      started.resolve();
      await release.promise;
      return subscription;
    });

    const checkout = checkoutPost(checkoutRequest());
    await started.promise;
    const eventId = `billing-it-${randomUUID()}`;
    webhookExternalIds.push(eventId);
    const event: AsaasEvent = {
      id: eventId,
      event: "SUBSCRIPTION_DELETED",
      subscription: { id: remoteId },
    };
    const received = await receiveAsaasWebhook(event, event as unknown as Prisma.InputJsonValue);
    const unlinked = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "asaas", externalId: eventId } },
    });
    release.resolve();
    const checkoutResponse = await checkout;

    expect(received).toBe("PENDING");
    expect(unlinked.processedAt).toBeNull();
    expect(checkoutResponse.status).toBe(201);
    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    const processed = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "asaas", externalId: eventId } },
    });
    expect(persisted.gatewaySubscriptionId).toBe(remoteId);
    expect(processed.processedAt).toBeInstanceOf(Date);
    expect(persisted.status).toBe("CANCELED");
  });

  it("serializa webhook duplicado no PostgreSQL e aplica pagamento apenas uma vez", async () => {
    const remoteId = "sub_duplicate_event_test";
    const currentPeriodEnd = new Date("2026-11-09T03:00:00.000Z");
    const fixture = await createFixture({
      status: "TRIALING",
      gatewaySubscriptionId: remoteId,
      currentPeriodEnd,
    });
    const eventId = `billing-it-${randomUUID()}`;
    webhookExternalIds.push(eventId);
    const event: AsaasEvent = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_duplicate_test", subscription: remoteId, dueDate: "2026-11-09" },
    };

    const results = await Promise.all([
      receiveAsaasWebhook(event, event as unknown as Prisma.InputJsonValue),
      receiveAsaasWebhook(event, event as unknown as Prisma.InputJsonValue),
    ]);

    expect(results).toContain("PROCESSED");
    expect(results).toContain("DUPLICATE");
    expect(mocks.getPayment).not.toHaveBeenCalled();
    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.status).toBe("ACTIVE");
    expect(persisted.currentPeriodEnd?.toISOString()).toBe("2026-12-09T03:00:00.000Z");
  });

  it("persiste evento de vencimento e conserva a data que inicia a tolerância", async () => {
    const remoteId = "sub_overdue_test";
    const due = new Date("2026-11-07T03:00:00.000Z");
    const fixture = await createFixture({ status: "ACTIVE", gatewaySubscriptionId: remoteId, currentPeriodEnd: due });
    const eventId = `billing-it-${randomUUID()}`;
    webhookExternalIds.push(eventId);
    const event: AsaasEvent = {
      id: eventId,
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_overdue_test", subscription: remoteId, dueDate: "2026-11-07" },
    };

    await expect(receiveAsaasWebhook(event, event as unknown as Prisma.InputJsonValue)).resolves.toBe("PROCESSED");

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.status).toBe("PAST_DUE");
    expect(persisted.currentPeriodEnd?.toISOString()).toBe("2026-11-07T03:00:00.000Z");
  });

  it("reconcilia dueDate ausente com resposta mockada e deixa falha sem confirmação pendente", async () => {
    const remoteId = "sub_due_date_test";
    const fixture = await createFixture({ status: "TRIALING", gatewaySubscriptionId: remoteId });
    const confirmedId = `billing-it-${randomUUID()}`;
    const pendingId = `billing-it-${randomUUID()}`;
    webhookExternalIds.push(confirmedId, pendingId);
    const confirmed: AsaasEvent = {
      id: confirmedId,
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_without_due_date", subscription: remoteId },
    };
    mocks.getPayment.mockResolvedValueOnce({
      id: "pay_without_due_date",
      status: "CONFIRMED",
      subscription: remoteId,
      dueDate: "2026-11-09",
    });

    await expect(receiveAsaasWebhook(confirmed, confirmed as unknown as Prisma.InputJsonValue)).resolves.toBe("PROCESSED");
    const resolved = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "asaas", externalId: confirmedId } },
    });
    expect((resolved.payload as { payment?: { dueDate?: string } }).payment?.dueDate).toBe("2026-11-09");

    const pending: AsaasEvent = {
      id: pendingId,
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_unavailable", subscription: remoteId },
    };
    await expect(receiveAsaasWebhook(pending, pending as unknown as Prisma.InputJsonValue)).resolves.toBe("PENDING");
    const unresolved = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "asaas", externalId: pendingId } },
    });
    expect(unresolved.processedAt).toBeNull();
    expect(mocks.getPayment).toHaveBeenCalledTimes(2);
  });

  it("cancela trial imediatamente e impede uma segunda solicitação confirmada", async () => {
    const fixture = await createFixture({
      status: "TRIALING",
      gatewaySubscriptionId: "sub_trial_cancel_test",
      currentPeriodEnd: new Date(Date.now() + 7 * 86_400_000),
    });
    queueSessions(fixture, fixture);

    const first = await cancelPost();
    const second = await cancelPost();

    expect(first.status).toBe(200);
    expect((await responseBody(first)).data?.status).toBe("CANCELED");
    expect(second.status).toBe(409);
    expect(mocks.deleteSubscription).toHaveBeenCalledTimes(1);
    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.status).toBe("CANCELED");
    expect(persisted.cancellationConfirmed).toBe(true);
    expect(persisted.accessEndsAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("mantém acesso pago e incorpora pagamento confirmado durante o cancelamento", async () => {
    const remoteId = "sub_paid_cancel_test";
    const fixture = await createFixture({
      status: "ACTIVE",
      gatewaySubscriptionId: remoteId,
      currentPeriodEnd: new Date("2026-12-01T03:00:00.000Z"),
    });
    queueSessions(fixture);
    const started = deferred();
    const release = deferred();
    mocks.deleteSubscription.mockImplementation(async () => {
      started.resolve();
      await release.promise;
      return { deleted: true };
    });
    const eventId = `billing-it-${randomUUID()}`;
    webhookExternalIds.push(eventId);
    const payment: AsaasEvent = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_during_cancel", subscription: remoteId, dueDate: "2026-12-01" },
    };

    const cancellation = cancelPost();
    await started.promise;
    await expect(receiveAsaasWebhook(payment, payment as unknown as Prisma.InputJsonValue)).resolves.toBe("PROCESSED");
    release.resolve();
    const response = await cancellation;

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data?.status).toBe("CANCELING");
    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.status).toBe("ACTIVE");
    expect(persisted.currentPeriodEnd?.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(persisted.accessEndsAt?.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(persisted.cancellationConfirmed).toBe(true);
  });

  it("permite retry de cancelamento após falha remota sem confirmar sucesso local", async () => {
    const fixture = await createFixture({
      status: "ACTIVE",
      gatewaySubscriptionId: "sub_cancel_retry_test",
      currentPeriodEnd: new Date("2026-12-01T03:00:00.000Z"),
    });
    queueSessions(fixture, fixture);
    mocks.deleteSubscription
      .mockRejectedValueOnce(new HttpError(502, "CANCEL_UNCONFIRMED", "Falha remota simulada"))
      .mockResolvedValueOnce({ deleted: true });

    const failed = await cancelPost();
    const afterFailure = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    const retried = await cancelPost();

    expect(failed.status).toBe(502);
    expect(afterFailure.cancellationConfirmed).toBe(false);
    expect(afterFailure.accessEndsAt?.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(retried.status).toBe(200);
    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(persisted.status).toBe("ACTIVE");
    expect(persisted.cancellationConfirmed).toBe(true);
    expect(mocks.deleteSubscription).toHaveBeenCalledTimes(2);
  });
});
