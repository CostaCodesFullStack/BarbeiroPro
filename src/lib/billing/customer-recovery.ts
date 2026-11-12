import { isDefinitiveCheckoutDecline } from "./checkout-recovery";

export const CUSTOMER_CHECKING = "CUSTOMER_CHECKING" as const;
export const CUSTOMER_IN_FLIGHT = "CUSTOMER_IN_FLIGHT" as const;
export const CUSTOMER_RECONCILIATION_REQUIRED = "CUSTOMER_RECONCILIATION_REQUIRED" as const;

export type CustomerRecoveryStatus =
  | typeof CUSTOMER_CHECKING
  | typeof CUSTOMER_IN_FLIGHT
  | typeof CUSTOMER_RECONCILIATION_REQUIRED;

export type CustomerResource = {
  id?: string;
  externalReference?: string | null;
};

export type CustomerSnapshot = {
  customerId: string | null;
  status: string | null;
};

export type CustomerCheckoutStore = {
  reserve(): Promise<CustomerSnapshot>;
  claimCreate(): Promise<boolean>;
  persist(customerId: string): Promise<"SAVED" | "CONFLICT">;
  markReconciliationRequired(): Promise<void>;
  markFailed(): Promise<void>;
};

export type CustomerCheckoutGateway = {
  findByExternalReference(reference: string): Promise<{
    data: CustomerResource[];
    hasMore?: boolean;
  }>;
  create(): Promise<CustomerResource>;
};

export type CustomerSetupResult =
  | { kind: "ready"; customerId: string }
  | { kind: "pending" }
  | { kind: "reconcile" };

export type CustomerRecoveryAction = "CREATE" | "RECOVER" | "PENDING" | "RECONCILE";

export function customerRecoveryAction(input: {
  status: string | null;
  remoteCount: number;
  remoteListComplete: boolean;
  ownsCreateClaim: boolean;
}): CustomerRecoveryAction {
  if (
    !input.remoteListComplete ||
    input.remoteCount > 1 ||
    input.status === CUSTOMER_RECONCILIATION_REQUIRED
  ) return "RECONCILE";
  if (input.remoteCount === 1) return "RECOVER";
  if (input.status === CUSTOMER_CHECKING && input.ownsCreateClaim) return "CREATE";
  return "PENDING";
}

function isDefinitelyRejectedBeforeCustomerCreation(error: unknown): boolean {
  if (isDefinitiveCheckoutDecline(error)) return true;
  return isBillingNotConfigured(error);
}

function isBillingNotConfigured(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "BILLING_NOT_CONFIGURED";
}

async function persistFoundCustomer(
  store: CustomerCheckoutStore,
  customerId: string,
): Promise<CustomerSetupResult> {
  let persisted: "SAVED" | "CONFLICT";
  try {
    persisted = await store.persist(customerId);
  } catch {
    // The remote customer is recoverable by externalReference on the next attempt.
    return { kind: "pending" };
  }

  if (persisted === "CONFLICT") {
    await store.markReconciliationRequired().catch(() => undefined);
    return { kind: "reconcile" };
  }
  return { kind: "ready", customerId };
}

/**
 * Reuses or recovers the tenant's Asaas customer before subscription creation.
 * A customer POST is allowed only after a durable, atomic store claim.
 */
export async function ensureCustomerForCheckout(
  externalReference: string,
  store: CustomerCheckoutStore,
  gateway: CustomerCheckoutGateway,
): Promise<CustomerSetupResult> {
  const snapshot = await store.reserve();
  if (snapshot.customerId) return { kind: "ready", customerId: snapshot.customerId };
  if (snapshot.status === CUSTOMER_RECONCILIATION_REQUIRED) return { kind: "reconcile" };

  let remote: { data: CustomerResource[]; hasMore?: boolean };
  try {
    remote = await gateway.findByExternalReference(externalReference);
  } catch (error) {
    if (isBillingNotConfigured(error)) throw error;
    return { kind: "pending" };
  }

  const matches = remote.data.filter((candidate) => candidate.externalReference === externalReference);
  const complete = remote.hasMore !== true;
  let action = customerRecoveryAction({
    status: snapshot.status,
    remoteCount: matches.length,
    remoteListComplete: complete,
    ownsCreateClaim: false,
  });

  if (action === "RECONCILE") {
    await store.markReconciliationRequired().catch(() => undefined);
    return { kind: "reconcile" };
  }
  if (action === "RECOVER") {
    const customerId = matches[0]?.id;
    if (!customerId) {
      await store.markReconciliationRequired().catch(() => undefined);
      return { kind: "reconcile" };
    }
    return persistFoundCustomer(store, customerId);
  }
  if (snapshot.status !== CUSTOMER_CHECKING || matches.length !== 0 || !complete) {
    return { kind: "pending" };
  }

  const ownsCreateClaim = await store.claimCreate();
  action = customerRecoveryAction({
    status: snapshot.status,
    remoteCount: 0,
    remoteListComplete: true,
    ownsCreateClaim,
  });
  if (action !== "CREATE") return { kind: "pending" };

  let created: CustomerResource;
  try {
    created = await gateway.create();
  } catch (error) {
    if (isDefinitelyRejectedBeforeCustomerCreation(error)) {
      await store.markFailed().catch(() => undefined);
      throw error;
    }
    // A timeout or 5xx can follow a successful remote write. Keep the claim so
    // the next request looks up the stable externalReference instead of POSTing.
    return { kind: "pending" };
  }

  if (!created.id) return { kind: "pending" };
  return persistFoundCustomer(store, created.id);
}
