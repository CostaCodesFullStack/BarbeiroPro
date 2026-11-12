import { zonedToUtc } from "../availability/tz";
import { PAST_DUE_GRACE_DAYS } from "./access";

export type SubStatus = "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type AsaasEvent = {
  id: string;
  event: string;
  payment?: { id?: string; subscription?: string | null; dueDate?: string };
  subscription?: { id?: string };
};

export type SubState = {
  status: SubStatus;
  currentPeriodEnd: Date | null;
  accessEndsAt?: Date | null;
  cancellationConfirmed?: boolean;
};
export type SubUpdate = {
  status?: SubStatus;
  currentPeriodEnd?: Date | null;
  accessEndsAt?: Date | null;
  cancellationConfirmed?: boolean;
} | null;

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
const DAY_MS = 86_400_000;

function laterDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Decide como um evento do Asaas altera a assinatura. Devolve null quando o evento
 * não muda nada. Significado de `currentPeriodEnd`:
 *  - ACTIVE:   fim do período já pago
 *  - PAST_DUE: data do vencimento NÃO pago (a tolerância de 5 dias conta a partir dela)
 *  - TRIALING: data da primeira cobrança
 */
export function decide(e: AsaasEvent, current: SubState): SubUpdate {
  const dueDate = e.payment?.dueDate;

  // Pagamentos liquidados antes da remoção continuam dando acesso ao período pago,
  // mesmo se o evento chegar depois da confirmação do cancelamento.
  if (current.status === "CANCELED") {
    if (
      current.cancellationConfirmed &&
      current.accessEndsAt &&
      (e.event === "PAYMENT_CONFIRMED" || e.event === "PAYMENT_RECEIVED") &&
      dueDate
    ) {
      const paidThrough = startOfDay(addOneMonth(dueDate));
      return { accessEndsAt: laterDate(current.accessEndsAt, paidThrough) };
    }
    return null;
  }

  if (current.cancellationConfirmed) {
    if (
      (e.event === "PAYMENT_CONFIRMED" || e.event === "PAYMENT_RECEIVED") &&
      dueDate &&
      current.accessEndsAt
    ) {
      const paidThrough = startOfDay(addOneMonth(dueDate));
      return { accessEndsAt: laterDate(current.accessEndsAt, paidThrough) };
    }
    return null;
  }

  switch (e.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      {
        // A confirmation without a due date cannot prove which billing period
        // was paid; keep the event for gateway reconciliation instead.
        if (!dueDate) return null;
        const nextPeriodEnd = startOfDay(addOneMonth(dueDate));
        if (current.currentPeriodEnd) {
          const paymentDate = startOfDay(dueDate);
          const alreadyCovered =
            (current.status === "ACTIVE" && nextPeriodEnd && nextPeriodEnd <= current.currentPeriodEnd) ||
            (current.status === "PAST_DUE" && paymentDate < current.currentPeriodEnd);
          if (alreadyCovered) return null;
        }
        return {
          status: "ACTIVE",
          currentPeriodEnd: nextPeriodEnd,
          ...(current.accessEndsAt && nextPeriodEnd
            ? { accessEndsAt: laterDate(current.accessEndsAt, nextPeriodEnd) }
            : {}),
        };
      }

    case "PAYMENT_OVERDUE":
    case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED": {
      // Sem dueDate não há base confiável para iniciar ou preservar os cinco dias de tolerância.
      if (!dueDate) return null;
      const due = startOfDay(dueDate);
      // Evento antigo fora de ordem: um período pago mais recente já cobre
      // este vencimento e não deve voltar a assinatura para PAST_DUE.
      if (current.status === "ACTIVE" && current.currentPeriodEnd && current.currentPeriodEnd > due) {
        return null;
      }
      // Se já está em atraso, preserva o vencimento mais antigo.
      const keepOlder =
        current.status === "PAST_DUE" && current.currentPeriodEnd && current.currentPeriodEnd < due;
      const effectiveDue = keepOlder ? current.currentPeriodEnd! : due;
      return {
        status: "PAST_DUE",
        currentPeriodEnd: effectiveDue,
        ...(current.accessEndsAt
          ? { accessEndsAt: new Date(effectiveDue.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS) }
          : {}),
      };
    }

    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      if (current.accessEndsAt) {
        return {
          ...(current.status === "TRIALING" ? { status: "CANCELED" as const } : {}),
          cancellationConfirmed: true,
        };
      }
      if (current.status === "ACTIVE" && current.currentPeriodEnd) {
        return { accessEndsAt: current.currentPeriodEnd, cancellationConfirmed: true };
      }
      if (current.status === "PAST_DUE" && current.currentPeriodEnd) {
        return {
          accessEndsAt: new Date(current.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS),
          cancellationConfirmed: true,
        };
      }
      return { status: "CANCELED" };

    default:
      return null;
  }
}
