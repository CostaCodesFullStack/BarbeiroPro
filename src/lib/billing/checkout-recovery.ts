export type CheckoutAttemptStatus =
  | "CHECKING"
  | "IN_FLIGHT"
  | "UNKNOWN"
  | "RECONCILIATION_REQUIRED"
  | "COMPLETE"
  | "FAILED"
  | "CUSTOMER_CHECKING"
  | "CUSTOMER_IN_FLIGHT"
  | "CUSTOMER_RECONCILIATION_REQUIRED";

export type CheckoutRecoveryAction = "CREATE" | "RECOVER" | "PENDING" | "RECONCILE";

export function isCheckoutInProgress(status: string | null): boolean {
  return [
    "CHECKING",
    "IN_FLIGHT",
    "UNKNOWN",
    "RECONCILIATION_REQUIRED",
    "CUSTOMER_CHECKING",
    "CUSTOMER_IN_FLIGHT",
  ].includes(status ?? "");
}

/** Chooses a safe next step; an inconclusive POST is never treated as permission to create again. */
export function checkoutRecoveryAction(input: {
  status: CheckoutAttemptStatus | null;
  hasLocalSubscription: boolean;
  remoteCount: number;
  remoteListComplete: boolean;
  ownsCreateClaim: boolean;
}): CheckoutRecoveryAction {
  if (input.hasLocalSubscription) return "RECOVER";
  if (
    !input.remoteListComplete ||
    input.remoteCount > 1 ||
    input.status === "RECONCILIATION_REQUIRED" ||
    input.status === "CUSTOMER_RECONCILIATION_REQUIRED"
  ) {
    return "RECONCILE";
  }
  if (input.remoteCount === 1) return "RECOVER";
  if (input.ownsCreateClaim && input.status === "CHECKING") return "CREATE";
  return "PENDING";
}

export function isDefinitiveCheckoutDecline(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "PAYMENT_REFUSED";
}
