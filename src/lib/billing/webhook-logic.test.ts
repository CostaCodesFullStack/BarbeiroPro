import { describe, expect, it } from "vitest";
import { addOneMonth, decide, subscriptionIdOf } from "./webhook-logic";

const trialing = { status: "TRIALING" as const, currentPeriodEnd: new Date("2026-11-09T03:00:00Z") };
const ev = (event: string, dueDate = "2026-11-09") => ({
  id: "evt_1",
  event,
  payment: { id: "pay_1", subscription: "sub_1", dueDate },
});

describe("addOneMonth", () => {
  it("soma um mês sem estourar o fim do mês", () => {
    expect(addOneMonth("2026-11-09")).toBe("2026-12-09");
    expect(addOneMonth("2026-01-31")).toBe("2026-02-28");
    expect(addOneMonth("2026-12-15")).toBe("2027-01-15");
  });
});

describe("subscriptionIdOf", () => {
  it("lê o id da assinatura do evento de cobrança ou de assinatura", () => {
    expect(subscriptionIdOf(ev("PAYMENT_CONFIRMED"))).toBe("sub_1");
    expect(subscriptionIdOf({ id: "e", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_2" } })).toBe("sub_2");
    expect(subscriptionIdOf({ id: "e", event: "X" })).toBeNull();
  });
});

describe("decide", () => {
  it("pagamento confirmado ativa e estende o período em um mês", () => {
    const r = decide(ev("PAYMENT_CONFIRMED"), trialing);
    expect(r?.status).toBe("ACTIVE");
    expect(r?.currentPeriodEnd?.toISOString()).toBe("2026-12-09T03:00:00.000Z");
  });

  it("PAYMENT_RECEIVED também ativa", () => {
    expect(decide(ev("PAYMENT_RECEIVED"), trialing)?.status).toBe("ACTIVE");
  });

  it("cobrança vencida coloca em atraso, guardando o vencimento não pago", () => {
    const r = decide(ev("PAYMENT_OVERDUE", "2026-12-09"), { status: "ACTIVE", currentPeriodEnd: new Date("2026-12-09T03:00:00Z") });
    expect(r?.status).toBe("PAST_DUE");
    expect(r?.currentPeriodEnd?.toISOString()).toBe("2026-12-09T03:00:00.000Z");
  });

  it("cartão recusado na cobrança também coloca em atraso", () => {
    expect(decide(ev("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"), trialing)?.status).toBe("PAST_DUE");
  });

  it("já em atraso preserva o vencimento mais antigo", () => {
    const antigo = new Date("2026-11-09T03:00:00Z");
    const r = decide(ev("PAYMENT_OVERDUE", "2026-12-09"), { status: "PAST_DUE", currentPeriodEnd: antigo });
    expect(r?.currentPeriodEnd).toEqual(antigo);
  });

  it("assinatura removida ou inativada cancela", () => {
    expect(decide({ id: "e", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } }, trialing)).toEqual({ status: "CANCELED" });
    expect(decide({ id: "e", event: "SUBSCRIPTION_INACTIVATED", subscription: { id: "sub_1" } }, trialing)).toEqual({ status: "CANCELED" });
  });

  it("cancelada não é reativada por pagamento atrasado", () => {
    expect(decide(ev("PAYMENT_CONFIRMED"), { status: "CANCELED", currentPeriodEnd: null })).toBeNull();
  });

  it("eventos irrelevantes não mudam nada", () => {
    expect(decide(ev("PAYMENT_CREATED"), trialing)).toBeNull();
    expect(decide(ev("PAYMENT_UPDATED"), trialing)).toBeNull();
  });
});
