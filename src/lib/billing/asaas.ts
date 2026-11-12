import { HttpError } from "@/lib/api";
import { getEnv } from "@/lib/env";

/**
 * Cliente mínimo da API do Asaas (v3). Docs: https://docs.asaas.com
 * ATENÇÃO: nunca registrar em log o corpo das requisições de assinatura (contém dados do cartão).
 */

type AsaasError = { errors?: { code?: string; description?: string }[] };

const SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";
const SANDBOX_API_KEY_PREFIX = "$aact_hmlg_";
const BILLING_NOT_CONFIGURED = "Cobrança indisponível no momento. Tente mais tarde.";

function isLocalRuntime(env: ReturnType<typeof getEnv>) {
  if (env.NODE_ENV !== "production") return true;

  try {
    const hostname = new URL(env.APP_URL).hostname.toLowerCase();
    return hostname === "localhost"
      || hostname.endsWith(".localhost")
      || hostname === "::1"
      || hostname === "[::1]"
      || /^127\./.test(hostname);
  } catch {
    // Uma URL inválida não deve ser tratada como uma aplicação pública.
    return true;
  }
}

function isOfficialSandboxUrl(value: string) {
  try {
    const url = new URL(value);
    const pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    return url.protocol === "https:"
      && url.port === ""
      && `${url.origin}${pathname}` === SANDBOX_BASE_URL
      && url.username === ""
      && url.password === ""
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

function getBillingConfigurationError() {
  return new HttpError(503, "BILLING_NOT_CONFIGURED", BILLING_NOT_CONFIGURED);
}

async function call<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  options: { ignoreNotFound?: boolean; cancellation?: boolean } = {},
): Promise<T> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch {
    throw getBillingConfigurationError();
  }

  if (!env.ASAAS_API_KEY || !env.ASAAS_BASE_URL) {
    throw getBillingConfigurationError();
  }

  // Desenvolvimento, testes e servidores locais nunca podem alcançar a API de produção.
  // O prefixo moderno da chave identifica Sandbox e evita misturar credenciais/URLs.
  if (isLocalRuntime(env)) {
    const sandboxConfigured = isOfficialSandboxUrl(env.ASAAS_BASE_URL)
      && env.ASAAS_API_KEY.startsWith(SANDBOX_API_KEY_PREFIX);
    if (!sandboxConfigured) throw getBillingConfigurationError();
  }

  let res: Response;
  try {
    res = await fetch(`${env.ASAAS_BASE_URL.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: env.ASAAS_API_KEY,
        "User-Agent": "BarbeiroPro",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    if (options.cancellation) {
      throw new HttpError(502, "CANCEL_UNCONFIRMED", "O Asaas não confirmou o cancelamento. A solicitação continua pendente; tente novamente.");
    }
    throw new HttpError(502, "BILLING_UNREACHABLE", "Não foi possível falar com o serviço de pagamento. Tente novamente.");
  }

  const json = (await res.json().catch(() => null)) as (T & AsaasError) | null;

  if (!res.ok) {
    if (res.status === 404 && options.ignoreNotFound) return { deleted: true } as T;
    const description = json?.errors?.[0]?.description;
    if (options.cancellation) {
      throw new HttpError(502, "CANCEL_UNCONFIRMED", description ?? "O Asaas não confirmou o cancelamento. A solicitação continua pendente; tente novamente.");
    }
    // 4xx = problema com os dados/cartão (mostramos a mensagem); 5xx = falha deles.
    if (res.status >= 400 && res.status < 500) {
      throw new HttpError(402, "PAYMENT_REFUSED", description ?? "O pagamento foi recusado. Confira os dados do cartão.");
    }
    throw new HttpError(502, "BILLING_ERROR", "O serviço de pagamento está com problemas. Tente novamente em instantes.");
  }
  return json as T;
}

export type AsaasCustomer = { id: string; externalReference?: string | null };
export type AsaasSubscription = {
  id: string;
  nextDueDate?: string;
  status?: string;
  deleted?: boolean;
  externalReference?: string | null;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  dueDate?: string;
  subscription?: string | null;
};

export function createCustomer(input: { name: string; email: string; cpfCnpj: string; externalReference: string }) {
  return call<AsaasCustomer>("POST", "/customers", input);
}

/** Consulta customers do tenant para recuperar um POST cujo resultado ficou incerto. */
export function findCustomersByExternalReference(externalReference: string) {
  const query = new URLSearchParams({ externalReference, limit: "100" });
  return call<{ data: AsaasCustomer[]; hasMore?: boolean }>("GET", `/customers?${query.toString()}`);
}

export function createCardSubscription(input: {
  customer: string;
  valueCents: number;
  nextDueDate: string; // YYYY-MM-DD: data da PRIMEIRA cobrança (fim do teste grátis)
  description: string;
  externalReference: string;
  card: { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
  holder: { name: string; email: string; cpfCnpj: string; postalCode: string; addressNumber: string; phone: string };
  remoteIp: string;
}) {
  return call<AsaasSubscription>("POST", "/subscriptions", {
    customer: input.customer,
    billingType: "CREDIT_CARD",
    value: input.valueCents / 100,
    nextDueDate: input.nextDueDate,
    cycle: "MONTHLY",
    description: input.description,
    externalReference: input.externalReference,
    creditCard: input.card,
    creditCardHolderInfo: input.holder,
    remoteIp: input.remoteIp,
  });
}

/** Consulta pontual por referência estável para recuperar uma criação inconclusiva. */
export function findSubscriptionsByExternalReference(externalReference: string) {
  const query = new URLSearchParams({ externalReference, includeDeleted: "true", limit: "100" });
  return call<{ data: AsaasSubscription[]; hasMore?: boolean }>("GET", `/subscriptions?${query.toString()}`);
}

/** Consulta pontual de uma cobrança para reconciliar um webhook sem vencimento. */
export function getPayment(id: string) {
  return call<AsaasPayment>("GET", `/payments/${encodeURIComponent(id)}`);
}

export function deleteSubscription(id: string) {
  return call<{ deleted?: boolean }>("DELETE", `/subscriptions/${encodeURIComponent(id)}`, undefined, {
    ignoreNotFound: true,
    cancellation: true,
  });
}
