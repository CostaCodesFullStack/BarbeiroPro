import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  eventUpdate: vi.fn(),
  getPayment: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  subscriptionUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEvent: { findUnique: mocks.findUnique, update: mocks.eventUpdate },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/billing/asaas", () => ({ getPayment: mocks.getPayment }));

import { processAsaasWebhookEvent } from "./webhook-processor";

const eventId = "00000000-0000-4000-8000-000000000001";
const event = {
  id: "evt_1",
  event: "PAYMENT_CONFIRMED",
  payment: { id: "pay_1", subscription: "sub_1" },
};

describe("processAsaasWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      $queryRaw: mocks.queryRaw,
      webhookEvent: { update: mocks.eventUpdate },
      subscription: { update: mocks.subscriptionUpdate },
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join("");
      if (query.includes("FROM webhook_events")) return [{ id: eventId, processedAt: null, payload: event }];
      if (query.includes("FROM subscriptions")) {
        return [{
          id: "tenant-subscription-id",
          status: "TRIALING",
          currentPeriodEnd: new Date("2026-11-10T03:00:00.000Z"),
          accessEndsAt: null,
          cancellationConfirmed: false,
        }];
      }
      throw new Error("Unexpected SQL in test");
    });
  });

  it("reconciles a confirmed payment without dueDate from the matching Asaas payment", async () => {
    mocks.findUnique.mockResolvedValue({ id: eventId, processedAt: null, payload: event });
    mocks.getPayment.mockResolvedValue({
      id: "pay_1",
      status: "CONFIRMED",
      subscription: "sub_1",
      dueDate: "2026-11-10",
    });

    await expect(processAsaasWebhookEvent(eventId)).resolves.toBe("PROCESSED");
    expect(mocks.getPayment).toHaveBeenCalledWith("pay_1");
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "tenant-subscription-id" },
      data: expect.objectContaining({ status: "ACTIVE" }),
    }));
    expect(mocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eventId },
      data: expect.objectContaining({ payload: expect.objectContaining({ payment: expect.objectContaining({ dueDate: "2026-11-10" }) }) }),
    }));
    expect(mocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eventId },
      data: expect.objectContaining({ processedAt: expect.any(Date) }),
    }));
  });

  it("leaves a confirmed event pending when the gateway cannot provide a trustworthy dueDate", async () => {
    mocks.findUnique.mockResolvedValue({ id: eventId, processedAt: null, payload: event });
    mocks.getPayment.mockRejectedValue(new Error("network unavailable"));

    await expect(processAsaasWebhookEvent(eventId)).resolves.toBe("PENDING");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("does not associate a payment with a different subscription returned by Asaas", async () => {
    mocks.findUnique.mockResolvedValue({ id: eventId, processedAt: null, payload: event });
    mocks.getPayment.mockResolvedValue({
      id: "pay_1",
      status: "CONFIRMED",
      subscription: "sub_other",
      dueDate: "2026-11-10",
    });

    await expect(processAsaasWebhookEvent(eventId)).resolves.toBe("PENDING");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it("does not discard an event received before its local subscription is linked", async () => {
    const subscriptionEvent = {
      id: "evt_unlinked",
      event: "SUBSCRIPTION_DELETED",
      subscription: { id: "sub_not_linked_yet" },
    };
    mocks.findUnique.mockResolvedValue({ id: eventId, processedAt: null, payload: subscriptionEvent });
    mocks.queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join("");
      if (query.includes("FROM webhook_events")) return [{ id: eventId, processedAt: null, payload: subscriptionEvent }];
      if (query.includes("FROM subscriptions")) return [];
      throw new Error("Unexpected SQL in test");
    });

    await expect(processAsaasWebhookEvent(eventId)).resolves.toBe("PENDING");
    expect(mocks.eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eventId },
      data: expect.objectContaining({ payload: expect.any(Object) }),
    }));
    expect(mocks.eventUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ processedAt: expect.any(Date) }),
    }));
  });

  it("does not reapply an already processed duplicate", async () => {
    mocks.findUnique.mockResolvedValue({ id: eventId, processedAt: new Date(), payload: event });
    await expect(processAsaasWebhookEvent(eventId)).resolves.toBe("DUPLICATE");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
