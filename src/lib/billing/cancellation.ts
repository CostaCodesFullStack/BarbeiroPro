import { PAST_DUE_GRACE_DAYS } from "./access";

const DAY_MS = 86_400_000;

export type CancellationState = "PENDING" | "SCHEDULED" | "ENDED";

/** Último instante de acesso conforme o estado comercial atual. */
export function cancellationAccessEnd(
  status: "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED",
  currentPeriodEnd: Date | null,
  requestedAt: Date,
): Date | null {
  if (status === "TRIALING" || status === "PENDING_PAYMENT") return requestedAt;
  if (status === "ACTIVE") return currentPeriodEnd;
  if (status === "PAST_DUE") {
    return currentPeriodEnd
      ? new Date(currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS)
      : requestedAt;
  }
  return requestedAt;
}

export function cancellationState(
  accessEndsAt: Date | null,
  confirmed: boolean,
  now: Date = new Date(),
): CancellationState | null {
  if (!accessEndsAt) return null;
  if (!confirmed) return "PENDING";
  return now.getTime() < accessEndsAt.getTime() ? "SCHEDULED" : "ENDED";
}
