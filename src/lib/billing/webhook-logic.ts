import { zonedToUtc } from "../availability/tz";

export type SubStatus = "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type AsaasEvent = {
  id: string;
  event: string;
  payment?: { id?: string; subscription?: string | null; dueDate?: string };
  subscription?: { id?: string };
};

export type SubState = { status: SubStatus; currentPeriodEnd: Date | null };
export type SubUpdate = { status: SubStatus; currentPeriodEnd?: Date | null } | null;

/** Id da assinatura no Asaas a que o evento se refere. */
export function subscriptionIdOf(e: AsaasEvent): string | null {
  return e.payment?.subscription ?? e.subscription?.id ?? null;
}

/** "2026-01-31" + 1 mês = "2026-02-28" (sem estourar para o mês seguinte). */
export function addOneMonth(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // último dia do mês seguinte
  return new Date(Date.UTC(y, m, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

const startOfDay = (date: string) => zonedToUtc(date, "00:00");

/**
 * Decide como um evento do Asaas altera a assinatura. Devolve null quando o evento
 * não muda nada. Significado de `currentPeriodEnd`:
 *  - ACTIVE:   fim do período já pago
 *  - PAST_DUE: data do vencimento NÃO pago (a tolerância de 5 dias conta a partir dela)
 *  - TRIALING: data da primeira cobrança
 */
export function decide(e: AsaasEvent, current: SubState): SubUpdate {
  // Assinatura cancelada não é reativada por eventos de cobrança atrasados.
  if (current.status === "CANCELED") return null;

  const dueDate = e.payment?.dueDate;

  switch (e.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return {
        status: "ACTIVE",
        currentPeriodEnd: dueDate ? startOfDay(addOneMonth(dueDate)) : current.currentPeriodEnd,
      };

    case "PAYMENT_OVERDUE":
    case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED": {
      if (!dueDate) return { status: "PAST_DUE" };
      const due = startOfDay(dueDate);
      // Se já está em atraso, preserva o vencimento mais antigo.
      const keepOlder =
        current.status === "PAST_DUE" && current.currentPeriodEnd && current.currentPeriodEnd < due;
      return { status: "PAST_DUE", currentPeriodEnd: keepOlder ? current.currentPeriodEnd : due };
    }

    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      return { status: "CANCELED" };

    default:
      return null;
  }
}
