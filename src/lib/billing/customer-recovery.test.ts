import { describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_CHECKING,
  CUSTOMER_IN_FLIGHT,
  CUSTOMER_RECONCILIATION_REQUIRED,
  customerRecoveryAction,
  ensureCustomerForCheckout,
  type CustomerCheckoutGateway,
  type CustomerCheckoutStore,
  type CustomerResource,
} from "./customer-recovery";

const tenantId = "tenant-1";

function createFixture(initial: {
  customerId?: string | null;
  status?: string | null;
  remote?: CustomerResource[];
} = {}) {
  let customerId = initial.customerId ?? null;
  let status = initial.status ?? null;
  let failPersist = false;
  const remote = [...(initial.remote ?? [])];
  const create = vi.fn(async () => {
    const customer = { id: "customer-" + create.mock.calls.length, externalReference: tenantId };
    remote.push(customer);
    return customer;
  });
  const store: CustomerCheckoutStore = {
    reserve: async () => {
      if (!customerId && (status === null || status === "FAILED")) status = CUSTOMER_CHECKING;
      return { customerId, status };
    },
    claimCreate: async () => {
      if (status !== CUSTOMER_CHECKING) return false;
      status = CUSTOMER_IN_FLIGHT;
      return true;
    },
    persist: async (id) => {
      if (failPersist) {
        failPersist = false;
        throw new Error("local persistence failed");
      }
      if (customerId && customerId !== id) return "CONFLICT";
      customerId = id;
      status = "CHECKING";
      return "SAVED";
    },
    markReconciliationRequired: async () => { status = CUSTOMER_RECONCILIATION_REQUIRED; },
    markFailed: async () => { status = "FAILED"; },
  };
  const gateway: CustomerCheckoutGateway = {
    findByExternalReference: async (reference) => ({
      data: remote.filter((entry) => entry.externalReference === reference),
    }),
    create,
  };

  return {
    store,
    gateway,
    create,
    remote,
    get customerId() { return customerId; },
    get status() { return status; },
    failNextPersist() { failPersist = true; },
    setStatus(value: string) { status = value; },
  };
}

describe("customerRecoveryAction", () => {
  it("permite POST somente para a requisição que possui o claim durável", () => {
    const input = { status: CUSTOMER_CHECKING, remoteCount: 0, remoteListComplete: true };
    expect(customerRecoveryAction({ ...input, ownsCreateClaim: true })).toBe("CREATE");
    expect(customerRecoveryAction({ ...input, ownsCreateClaim: false })).toBe("PENDING");
  });

  it("recupera um customer e exige reconciliação em respostas ambíguas", () => {
    expect(customerRecoveryAction({
      status: CUSTOMER_IN_FLIGHT, remoteCount: 1, remoteListComplete: true, ownsCreateClaim: false,
    })).toBe("RECOVER");
    expect(customerRecoveryAction({
      status: CUSTOMER_IN_FLIGHT, remoteCount: 2, remoteListComplete: true, ownsCreateClaim: false,
    })).toBe("RECONCILE");
    expect(customerRecoveryAction({
      status: CUSTOMER_IN_FLIGHT, remoteCount: 0, remoteListComplete: false, ownsCreateClaim: false,
    })).toBe("RECONCILE");
  });
});

describe("ensureCustomerForCheckout", () => {
  it("reutiliza um customer local sem consultar ou criar outro", async () => {
    const fixture = createFixture({ customerId: "customer-local" });
    const lookup = vi.spyOn(fixture.gateway, "findByExternalReference");

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({
      kind: "ready", customerId: "customer-local",
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it("recupera um customer remoto que foi criado antes de uma falha local", async () => {
    const fixture = createFixture({
      status: CUSTOMER_IN_FLIGHT,
      remote: [{ id: "customer-remote", externalReference: tenantId }],
    });

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({
      kind: "ready", customerId: "customer-remote",
    });
    expect(fixture.customerId).toBe("customer-remote");
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it("não repete POST após timeout mesmo quando a consulta ainda não encontra o customer", async () => {
    const fixture = createFixture();
    fixture.gateway.create = vi.fn().mockRejectedValue(new Error("timeout"));

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({ kind: "pending" });
    fixture.setStatus(CUSTOMER_IN_FLIGHT);
    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({ kind: "pending" });
    expect(fixture.gateway.create).toHaveBeenCalledTimes(1);
  });

  it("retorna erro de configuração em vez de deixar o checkout falsamente pendente", async () => {
    const fixture = createFixture();
    fixture.gateway.findByExternalReference = vi.fn().mockRejectedValue({ code: "BILLING_NOT_CONFIGURED" });

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway))
      .rejects.toMatchObject({ code: "BILLING_NOT_CONFIGURED" });
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it("recupera a criação remota após timeout e mantém o mesmo customer local", async () => {
    const fixture = createFixture();
    fixture.gateway.create = vi.fn(async () => {
      fixture.remote.push({ id: "customer-after-timeout", externalReference: tenantId });
      throw new Error("response timed out after remote write");
    });

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({ kind: "pending" });
    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({
      kind: "ready", customerId: "customer-after-timeout",
    });
    expect(fixture.gateway.create).toHaveBeenCalledTimes(1);
  });

  it("recupera se o POST funcionou mas a persistência local falhou", async () => {
    const fixture = createFixture();
    fixture.failNextPersist();

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({ kind: "pending" });
    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({
      kind: "ready", customerId: "customer-1",
    });
    expect(fixture.create).toHaveBeenCalledTimes(1);
  });

  it("serializa duas requisições concorrentes e usa o ID persistido na retomada", async () => {
    const fixture = createFixture();
    let releaseCreate: (() => void) | undefined;
    fixture.gateway.create = vi.fn(async () => {
      await new Promise<void>((resolve) => { releaseCreate = resolve; });
      const customer = { id: "customer-race", externalReference: tenantId };
      fixture.remote.push(customer);
      return customer;
    });

    const first = ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway);
    const second = ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway);
    await vi.waitFor(() => expect(fixture.gateway.create).toHaveBeenCalledTimes(1));
    releaseCreate?.();
    const results = await Promise.all([first, second]);

    expect(results.filter((result) => result.kind === "ready")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "pending")).toHaveLength(1);
    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({
      kind: "ready", customerId: "customer-race",
    });
    expect(fixture.gateway.create).toHaveBeenCalledTimes(1);
  });

  it("marca customer duplicado ou listagem incompleta para reconciliação", async () => {
    const duplicated = createFixture({
      status: CUSTOMER_IN_FLIGHT,
      remote: [
        { id: "customer-1", externalReference: tenantId },
        { id: "customer-2", externalReference: tenantId },
      ],
    });
    await expect(ensureCustomerForCheckout(tenantId, duplicated.store, duplicated.gateway)).resolves.toEqual({ kind: "reconcile" });
    expect(duplicated.status).toBe(CUSTOMER_RECONCILIATION_REQUIRED);
    expect(duplicated.create).not.toHaveBeenCalled();

    const incomplete = createFixture({ status: CUSTOMER_IN_FLIGHT });
    incomplete.gateway.findByExternalReference = vi.fn().mockResolvedValue({ data: [], hasMore: true });
    await expect(ensureCustomerForCheckout(tenantId, incomplete.store, incomplete.gateway)).resolves.toEqual({ kind: "reconcile" });
    expect(incomplete.create).not.toHaveBeenCalled();
  });

  it("libera nova tentativa somente após rejeição definitiva", async () => {
    const fixture = createFixture();
    fixture.gateway.create = vi.fn()
      .mockRejectedValueOnce({ code: "PAYMENT_REFUSED" })
      .mockResolvedValueOnce({ id: "customer-retry", externalReference: tenantId });

    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).rejects.toMatchObject({ code: "PAYMENT_REFUSED" });
    await expect(ensureCustomerForCheckout(tenantId, fixture.store, fixture.gateway)).resolves.toEqual({
      kind: "ready", customerId: "customer-retry",
    });
    expect(fixture.gateway.create).toHaveBeenCalledTimes(2);
  });
});
