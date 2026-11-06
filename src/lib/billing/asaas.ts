import { HttpError } from "@/lib/api";
import { getEnv } from "@/lib/env";

/**
 * Cliente mínimo da API do Asaas (v3). Docs: https://docs.asaas.com
 * ATENÇÃO: nunca registrar em log o corpo das requisições de assinatura (contém dados do cartão).
 */

type AsaasError = { errors?: { code?: string; description?: string }[] };

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const env = getEnv();
  if (!env.ASAAS_API_KEY || !env.ASAAS_BASE_URL) {
    throw new HttpError(503, "BILLING_NOT_CONFIGURED", "Cobrança indisponível no momento. Tente mais tarde.");
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
    throw new HttpError(502, "BILLING_UNREACHABLE", "Não foi possível falar com o serviço de pagamento. Tente novamente.");
  }

  const json = (await res.json().catch(() => null)) as (T & AsaasError) | null;

  if (!res.ok) {
    const description = json?.errors?.[0]?.description;
    // 4xx = problema com os dados/cartão (mostramos a mensagem); 5xx = falha deles.
    if (res.status >= 400 && res.status < 500) {
      throw new HttpError(402, "PAYMENT_REFUSED", description ?? "O pagamento foi recusado. Confira os dados do cartão.");
    }
    throw new HttpError(502, "BILLING_ERROR", "O serviço de pagamento está com problemas. Tente novamente em instantes.");
  }
  return json as T;
}

export type AsaasCustomer = { id: string };
export type AsaasSubscription = { id: string; nextDueDate?: string; status?: string };

export function createCustomer(input: { name: string; email: string; cpfCnpj: string; externalReference: string }) {
  return call<AsaasCustomer>("POST", "/customers", input);
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

export function deleteSubscription(id: string) {
  return call<{ deleted?: boolean }>("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
}
