import { describe, expect, it } from "vitest";
import { canTakeBookings, needsPaymentSetup } from "./access";

const now = new Date("2026-11-10T12:00:00Z");
const day = 86_400_000;
const base = {
  tenantStatus: "ACTIVE" as const,
  trialEndsAt: new Date(now.getTime() + 3 * day),
  currentPeriodEnd: null,
  now,
};

describe("canTakeBookings", () => {
  it("teste grátis dentro do prazo aceita", () => {
    expect(canTakeBookings({ ...base, subscriptionStatus: "TRIALING" })).toBe(true);
  });

  it("teste grátis vencido há pouco ainda aceita (folga de 24h para a cobrança confirmar)", () => {
    const venceuHaPouco = new Date(now.getTime() - 3_600_000);
    expect(canTakeBookings({ ...base, subscriptionStatus: "TRIALING", trialEndsAt: venceuHaPouco })).toBe(true);
  });

  it("teste grátis vencido há mais de 24h não aceita", () => {
    const venceu = new Date(now.getTime() - 25 * 3_600_000);
    expect(canTakeBookings({ ...base, subscriptionStatus: "TRIALING", trialEndsAt: venceu })).toBe(false);
  });

  it("aguardando pagamento não aceita", () => {
    expect(canTakeBookings({ ...base, subscriptionStatus: "PENDING_PAYMENT" })).toBe(false);
  });

  it("assinatura ativa aceita", () => {
    expect(canTakeBookings({ ...base, subscriptionStatus: "ACTIVE", trialEndsAt: new Date(0) })).toBe(true);
  });

  it("cancelamento pago confirmado mantém acesso até a data final e bloqueia depois", () => {
    const accessEndsAt = new Date(now.getTime() + day);
    expect(canTakeBookings({
      ...base,
      subscriptionStatus: "ACTIVE",
      accessEndsAt,
      cancellationConfirmed: true,
    })).toBe(true);
    expect(canTakeBookings({
      ...base,
      subscriptionStatus: "ACTIVE",
      accessEndsAt,
      cancellationConfirmed: true,
      now: accessEndsAt,
    })).toBe(false);
  });

  it("solicitação de cancelamento ainda não confirmada não corta acesso", () => {
    expect(canTakeBookings({
      ...base,
      subscriptionStatus: "ACTIVE",
      accessEndsAt: new Date(now.getTime() - day),
      cancellationConfirmed: false,
    })).toBe(true);
  });

  it("cancelamento em atraso preserva somente a tolerância de cinco dias", () => {
    const accessEndsAt = new Date(now.getTime() + day);
    expect(canTakeBookings({
      ...base,
      subscriptionStatus: "PAST_DUE",
      accessEndsAt,
      cancellationConfirmed: true,
    })).toBe(true);
    expect(canTakeBookings({
      ...base,
      subscriptionStatus: "PAST_DUE",
      accessEndsAt,
      cancellationConfirmed: true,
      now: accessEndsAt,
    })).toBe(false);
  });

  it("em atraso aceita só durante a tolerância de 5 dias", () => {
    const dentro = new Date(now.getTime() - 4 * day);
    const fora = new Date(now.getTime() - 6 * day);
    expect(canTakeBookings({ ...base, subscriptionStatus: "PAST_DUE", currentPeriodEnd: dentro })).toBe(true);
    expect(canTakeBookings({ ...base, subscriptionStatus: "PAST_DUE", currentPeriodEnd: fora })).toBe(false);
  });

  it("em atraso sem data de vencimento não aceita", () => {
    expect(canTakeBookings({ ...base, subscriptionStatus: "PAST_DUE" })).toBe(false);
  });

  it("cancelada, sem assinatura ou barbearia suspensa não aceita", () => {
    expect(canTakeBookings({ ...base, subscriptionStatus: "CANCELED" })).toBe(false);
    expect(canTakeBookings({ ...base, subscriptionStatus: null })).toBe(false);
    expect(canTakeBookings({ ...base, subscriptionStatus: "ACTIVE", tenantStatus: "SUSPENDED" })).toBe(false);
  });
});

describe("needsPaymentSetup", () => {
  it("conta nova precisa cadastrar o cartão", () => {
    expect(needsPaymentSetup({ status: "PENDING_PAYMENT", hasGateway: false })).toBe(true);
  });
  it("teste antigo sem assinatura no gateway também precisa", () => {
    expect(needsPaymentSetup({ status: "TRIALING", hasGateway: false })).toBe(true);
  });
  it("quem já tem assinatura no gateway não precisa", () => {
    expect(needsPaymentSetup({ status: "TRIALING", hasGateway: true })).toBe(false);
    expect(needsPaymentSetup({ status: "ACTIVE", hasGateway: true })).toBe(false);
  });
});
