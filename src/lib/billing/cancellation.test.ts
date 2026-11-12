import { describe, expect, it } from "vitest";
import { cancellationAccessEnd, cancellationState } from "./cancellation";

const now = new Date("2026-11-10T12:00:00.000Z");
const periodEnd = new Date("2026-11-15T03:00:00.000Z");

describe("cancellationAccessEnd", () => {
  it("encerra imediatamente o acesso cancelado durante o trial", () => {
    expect(cancellationAccessEnd("TRIALING", periodEnd, now)).toEqual(now);
  });

  it("mantém assinatura paga até o fim registrado do período", () => {
    expect(cancellationAccessEnd("ACTIVE", periodEnd, now)).toEqual(periodEnd);
  });

  it("preserva a tolerância atual de cinco dias ao cancelar em atraso", () => {
    expect(cancellationAccessEnd("PAST_DUE", periodEnd, now)).toEqual(
      new Date(periodEnd.getTime() + 5 * 86_400_000),
    );
  });

  it("não inventa um fim de período pago quando a data está ausente", () => {
    expect(cancellationAccessEnd("ACTIVE", null, now)).toBeNull();
  });
});

describe("cancellationState", () => {
  it("distingue solicitação pendente de cancelamento confirmado", () => {
    expect(cancellationState(periodEnd, false, now)).toBe("PENDING");
    expect(cancellationState(periodEnd, true, now)).toBe("SCHEDULED");
    expect(cancellationState(periodEnd, true, periodEnd)).toBe("ENDED");
  });
});
