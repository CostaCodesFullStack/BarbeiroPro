import { describe, expect, it } from "vitest";
import { checkoutRecoveryAction, isCheckoutInProgress, isDefinitiveCheckoutDecline } from "./checkout-recovery";

describe("checkoutRecoveryAction", () => {
  it("allows one request to create only after it wins the local claim", () => {
    expect(checkoutRecoveryAction({
      status: "CHECKING",
      hasLocalSubscription: false,
      remoteCount: 0,
      remoteListComplete: true,
      ownsCreateClaim: true,
    })).toBe("CREATE");
  });

  it("keeps inconclusive POST attempts pending when the lookup finds nothing", () => {
    for (const status of ["IN_FLIGHT", "UNKNOWN"] as const) {
      expect(checkoutRecoveryAction({
        status,
        hasLocalSubscription: false,
        remoteCount: 0,
        remoteListComplete: true,
        ownsCreateClaim: false,
      })).toBe("PENDING");
    }
    expect(checkoutRecoveryAction({
      status: "CHECKING",
      hasLocalSubscription: false,
      remoteCount: 0,
      remoteListComplete: true,
      ownsCreateClaim: false,
    })).toBe("PENDING");
  });

  it("recovers one match and requires reconciliation for ambiguous or incomplete results", () => {
    expect(checkoutRecoveryAction({
      status: "UNKNOWN", hasLocalSubscription: false, remoteCount: 1, remoteListComplete: true, ownsCreateClaim: false,
    })).toBe("RECOVER");
    expect(checkoutRecoveryAction({
      status: "UNKNOWN", hasLocalSubscription: false, remoteCount: 2, remoteListComplete: true, ownsCreateClaim: false,
    })).toBe("RECONCILE");
    expect(checkoutRecoveryAction({
      status: "UNKNOWN", hasLocalSubscription: false, remoteCount: 0, remoteListComplete: false, ownsCreateClaim: false,
    })).toBe("RECONCILE");
  });

  it("recognizes only explicit payment refusals as definitive declines", () => {
    expect(isDefinitiveCheckoutDecline({ code: "PAYMENT_REFUSED" })).toBe(true);
    expect(isDefinitiveCheckoutDecline({ code: "BILLING_UNREACHABLE" })).toBe(false);
    expect(isDefinitiveCheckoutDecline(new Error("timeout"))).toBe(false);
  });
});

describe("isCheckoutInProgress", () => {
  it("impede cancelamento enquanto customer ou assinatura está em reconciliação", () => {
    for (const status of [
      "CHECKING",
      "IN_FLIGHT",
      "UNKNOWN",
      "RECONCILIATION_REQUIRED",
      "CUSTOMER_CHECKING",
      "CUSTOMER_IN_FLIGHT",
    ]) {
      expect(isCheckoutInProgress(status)).toBe(true);
    }
    expect(isCheckoutInProgress(null)).toBe(false);
    expect(isCheckoutInProgress("FAILED")).toBe(false);
    expect(isCheckoutInProgress("COMPLETE")).toBe(false);
    expect(isCheckoutInProgress("CUSTOMER_RECONCILIATION_REQUIRED")).toBe(false);
  });
});
