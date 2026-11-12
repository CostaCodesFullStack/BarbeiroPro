import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
  vi.stubEnv("AUTH_SECRET", "test-secret-with-more-than-thirty-two-characters");
  vi.stubEnv("ASAAS_API_KEY", "$aact_hmlg_test-key");
  vi.stubEnv("ASAAS_BASE_URL", "https://api-sandbox.asaas.com/v3");
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "test-webhook-token-long-enough");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("deleteSubscription", () => {
  it("não trata falha de rede como cancelamento confirmado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { deleteSubscription } = await import("./asaas");

    await expect(deleteSubscription("sub_1")).rejects.toMatchObject({
      status: 502,
      code: "CANCEL_UNCONFIRMED",
    });
  });

  it("não trata erro do Asaas como cancelamento confirmado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ errors: [{ description: "temporarily unavailable" }] }),
      { status: 503 },
    )));
    const { deleteSubscription } = await import("./asaas");

    await expect(deleteSubscription("sub_1")).rejects.toMatchObject({
      status: 502,
      code: "CANCEL_UNCONFIRMED",
    });
  });

  it("aceita 404 como recorrência já removida para permitir nova tentativa idempotente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const { deleteSubscription } = await import("./asaas");

    await expect(deleteSubscription("sub_1")).resolves.toEqual({ deleted: true });
  });
});

describe("findCustomersByExternalReference", () => {
  it("consulta somente a referência externa do tenant com limite explícito", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        data: [{ id: "cus_1", externalReference: "tenant_1" }],
        hasMore: false,
      }),
      { status: 200 },
    )));
    const { findCustomersByExternalReference } = await import("./asaas");

    await expect(findCustomersByExternalReference("tenant_1")).resolves.toMatchObject({
      data: [{ id: "cus_1", externalReference: "tenant_1" }],
      hasMore: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/customers?externalReference=tenant_1&limit=100"),
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("Asaas environment guard", () => {
  it.each(["development", "test"] as const)(
    "rejects the production endpoint in %s before fetch",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("ASAAS_API_KEY", "$aact_prod_test-key");
      vi.stubEnv("ASAAS_BASE_URL", "https://api.asaas.com/v3");
      const mockedFetch = vi.fn();
      vi.stubGlobal("fetch", mockedFetch);
      const { createCustomer } = await import("./asaas");

      await expect(createCustomer({
        name: "Test",
        email: "test@example.com",
        cpfCnpj: "00000000000",
        externalReference: "tenant_test",
      })).rejects.toMatchObject({ status: 503, code: "BILLING_NOT_CONFIGURED" });
      expect(mockedFetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    "https://asaas.example.invalid/v3",
    "https://api-sandbox.asaas.com/v2",
    "http://api-sandbox.asaas.com/v3",
    "https://user:password@api-sandbox.asaas.com/v3",
    "https://api-sandbox.asaas.com/v3?redirect=1",
  ])("rejects an invalid or unknown Sandbox URL (%s) before fetch", async (baseUrl) => {
    vi.stubEnv("ASAAS_BASE_URL", baseUrl);
    const mockedFetch = vi.fn();
    vi.stubGlobal("fetch", mockedFetch);
    const { findCustomersByExternalReference } = await import("./asaas");

    await expect(findCustomersByExternalReference("tenant_test")).rejects.toMatchObject({
      status: 503,
      code: "BILLING_NOT_CONFIGURED",
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects credentials with a production prefix paired with the Sandbox URL", async () => {
    vi.stubEnv("ASAAS_API_KEY", "$aact_prod_test-key");
    const mockedFetch = vi.fn();
    vi.stubGlobal("fetch", mockedFetch);
    const { getPayment } = await import("./asaas");

    await expect(getPayment("pay_test")).rejects.toMatchObject({
      status: 503,
      code: "BILLING_NOT_CONFIGURED",
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each([
    { apiKey: "", baseUrl: "" },
    { apiKey: "$aact_hmlg_test-key", baseUrl: "not-a-url" },
  ])("rejects missing or malformed configuration with a controlled error before fetch", async ({ apiKey, baseUrl }) => {
    vi.stubEnv("ASAAS_API_KEY", apiKey);
    vi.stubEnv("ASAAS_BASE_URL", baseUrl);
    const mockedFetch = vi.fn();
    vi.stubGlobal("fetch", mockedFetch);
    const { deleteSubscription } = await import("./asaas");

    await expect(deleteSubscription("sub_test")).rejects.toMatchObject({
      status: 503,
      code: "BILLING_NOT_CONFIGURED",
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("requires Sandbox even when a local server runs with NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ASAAS_API_KEY", "$aact_prod_test-key");
    vi.stubEnv("ASAAS_BASE_URL", "https://api.asaas.com/v3");
    const mockedFetch = vi.fn();
    vi.stubGlobal("fetch", mockedFetch);
    const { findSubscriptionsByExternalReference } = await import("./asaas");

    await expect(findSubscriptionsByExternalReference("tenant_test")).rejects.toMatchObject({
      status: 503,
      code: "BILLING_NOT_CONFIGURED",
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("keeps production requests compatible when configured for production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://barbeiropro.example");
    vi.stubEnv("ASAAS_API_KEY", "$aact_prod_test-key");
    vi.stubEnv("ASAAS_BASE_URL", "https://api.asaas.com/v3");
    const mockedFetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "cus_test", externalReference: "tenant_test" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", mockedFetch);
    const { createCustomer } = await import("./asaas");

    await expect(createCustomer({
      name: "Test",
      email: "test@example.com",
      cpfCnpj: "00000000000",
      externalReference: "tenant_test",
    })).resolves.toMatchObject({ id: "cus_test" });
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://api.asaas.com/v3/customers",
      expect.objectContaining({ headers: expect.objectContaining({ access_token: "$aact_prod_test-key" }) }),
    );
  });

  it("blocks every exported Asaas operation through the shared client guard", async () => {
    vi.stubEnv("ASAAS_BASE_URL", "https://api.asaas.com/v3");
    vi.stubEnv("ASAAS_API_KEY", "$aact_prod_test-key");
    const mockedFetch = vi.fn();
    vi.stubGlobal("fetch", mockedFetch);
    const asaas = await import("./asaas");
    const operations = [
      () => asaas.createCustomer({ name: "Test", email: "test@example.com", cpfCnpj: "00000000000", externalReference: "tenant_test" }),
      () => asaas.findCustomersByExternalReference("tenant_test"),
      () => asaas.createCardSubscription({
        customer: "cus_test",
        valueCents: 7990,
        nextDueDate: "2026-11-15",
        description: "BarbeiroPro",
        externalReference: "tenant_test",
        card: { holderName: "Test", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
        holder: { name: "Test", email: "test@example.com", cpfCnpj: "00000000000", postalCode: "00000000", addressNumber: "1", phone: "11999999999" },
        remoteIp: "127.0.0.1",
      }),
      () => asaas.findSubscriptionsByExternalReference("tenant_test"),
      () => asaas.getPayment("pay_test"),
      () => asaas.deleteSubscription("sub_test"),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({ status: 503, code: "BILLING_NOT_CONFIGURED" });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
