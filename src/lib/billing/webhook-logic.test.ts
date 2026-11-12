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

  it("does not activate or recover a subscription when a confirmed payment has no dueDate", () => {
    const missingDueDate = { id: "evt_missing_due", event: "PAYMENT_CONFIRMED", payment: { subscription: "sub_1" } };
    expect(decide(missingDueDate, trialing)).toBeNull();
    expect(decide(missingDueDate, { status: "PAST_DUE", currentPeriodEnd: trialing.currentPeriodEnd })).toBeNull();
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

  it("ignora um atraso antigo que chega depois da confirmação mais recente", () => {
    const paidThrough = new Date("2026-12-09T03:00:00Z");
    expect(decide(ev("PAYMENT_OVERDUE", "2026-11-09"), {
      status: "ACTIVE",
      currentPeriodEnd: paidThrough,
    })).toBeNull();
  });

  it("não reativa por um pagamento antigo recebido após o vencimento atual", () => {
    const currentDue = new Date("2026-12-09T03:00:00Z");
    expect(decide(ev("PAYMENT_CONFIRMED", "2026-11-09"), {
      status: "PAST_DUE",
      currentPeriodEnd: currentDue,
    })).toBeNull();
  });

  it("não altera estado de atraso sem vencimento identificável", () => {
    const overdue = { id: "evt", event: "PAYMENT_OVERDUE", payment: { subscription: "sub_1" } };
    expect(decide(overdue, {
      status: "ACTIVE",
      currentPeriodEnd: new Date("2026-12-09T03:00:00Z"),
    })).toBeNull();
    expect(decide(overdue, {
      status: "PAST_DUE",
      currentPeriodEnd: new Date("2026-12-09T03:00:00Z"),
    })).toBeNull();
  });

  it("assinatura removida ou inativada cancela", () => {
    expect(decide({ id: "e", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } }, trialing)).toEqual({ status: "CANCELED" });
    expect(decide({ id: "e", event: "SUBSCRIPTION_INACTIVATED", subscription: { id: "sub_1" } }, trialing)).toEqual({ status: "CANCELED" });
  });

  it("cancelada não é reativada por pagamento atrasado", () => {
    expect(decide(ev("PAYMENT_CONFIRMED"), { status: "CANCELED", currentPeriodEnd: null })).toBeNull();
  });

  it("remoção do Asaas confirma cancelamento sem cortar o período pago", () => {
    const accessEndsAt = new Date("2026-12-09T03:00:00.000Z");
    expect(decide(
      { id: "evt_delete", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } },
      { status: "ACTIVE", currentPeriodEnd: accessEndsAt, accessEndsAt },
    )).toEqual({ cancellationConfirmed: true });
  });

  it("remoção externa também preserva o período pago e a tolerância vigente", () => {
    const paidThrough = new Date("2026-12-09T03:00:00.000Z");
    expect(decide(
      { id: "evt_delete", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } },
      { status: "ACTIVE", currentPeriodEnd: paidThrough },
    )).toEqual({ accessEndsAt: paidThrough, cancellationConfirmed: true });

    expect(decide(
      { id: "evt_delete", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } },
      { status: "PAST_DUE", currentPeriodEnd: paidThrough },
    )).toEqual({
      accessEndsAt: new Date(paidThrough.getTime() + 5 * 86_400_000),
      cancellationConfirmed: true,
    });
  });

  it("remoção confirmada durante trial cancela imediatamente", () => {
    const accessEndsAt = new Date("2026-11-09T03:00:00.000Z");
    expect(decide(
      { id: "evt_delete", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } },
      { status: "TRIALING", currentPeriodEnd: accessEndsAt, accessEndsAt },
    )).toEqual({ status: "CANCELED", cancellationConfirmed: true });
  });

  it("webhook de pagamento atrasado não reativa assinatura já cancelada, mas estende o acesso pago", () => {
    const accessEndsAt = new Date("2026-12-09T03:00:00.000Z");
    const update = decide(ev("PAYMENT_CONFIRMED", "2026-12-09"), {
      status: "ACTIVE",
      currentPeriodEnd: accessEndsAt,
      accessEndsAt,
      cancellationConfirmed: true,
    });
    expect(update?.status).toBeUndefined();
    expect(update?.accessEndsAt?.toISOString()).toBe("2027-01-09T03:00:00.000Z");
  });

  it("pagamento confirmado atrasado pode estender acesso mesmo após cancelamento imediato", () => {
    const accessEndsAt = new Date("2026-11-09T03:00:00.000Z");
    const update = decide(ev("PAYMENT_CONFIRMED"), {
      status: "CANCELED",
      currentPeriodEnd: accessEndsAt,
      accessEndsAt,
      cancellationConfirmed: true,
    });
    expect(update?.status).toBeUndefined();
    expect(update?.accessEndsAt?.toISOString()).toBe("2026-12-09T03:00:00.000Z");
  });

  it("webhook de falha conserva tolerância de cinco dias durante cancelamento pendente", () => {
    const due = new Date("2026-12-09T03:00:00.000Z");
    const update = decide(ev("PAYMENT_OVERDUE", "2026-12-09"), {
      status: "ACTIVE",
      currentPeriodEnd: due,
      accessEndsAt: due,
    });
    expect(update?.status).toBe("PAST_DUE");
    expect(update?.accessEndsAt?.toISOString()).toBe("2026-12-14T03:00:00.000Z");
  });

  it("payment confirmation recovers a subscription after an overdue event", () => {
    const overdue = decide(ev("PAYMENT_OVERDUE", "2026-11-09"), {
      status: "ACTIVE",
      currentPeriodEnd: new Date("2026-11-09T03:00:00Z"),
    });
    expect(overdue?.status).toBe("PAST_DUE");
    const recovered = decide(ev("PAYMENT_CONFIRMED", "2026-11-09"), {
      status: "PAST_DUE",
      currentPeriodEnd: new Date("2026-11-09T03:00:00Z"),
    });
    expect(recovered?.status).toBe("ACTIVE");
    expect(recovered?.currentPeriodEnd?.toISOString()).toBe("2026-12-09T03:00:00.000Z");
  });

  it("eventos irrelevantes não mudam nada", () => {
    expect(decide(ev("PAYMENT_CREATED"), trialing)).toBeNull();
    expect(decide(ev("PAYMENT_UPDATED"), trialing)).toBeNull();
  });
});
