/** Dias de tolerância após o vencimento antes de bloquear (ver AGENTS.md, seção 8). */
export const PAST_DUE_GRACE_DAYS = 5;
/**
 * Folga após o fim do teste: a primeira cobrança sai no dia do vencimento e pode levar
 * algumas horas para ser confirmada. Sem isso o cliente ficaria bloqueado enquanto paga.
 */
export const TRIAL_BUFFER_HOURS = 24;

export type AccessInput = {
  tenantStatus: "ACTIVE" | "SUSPENDED";
  subscriptionStatus: "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | null;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  now?: Date;
};

/**
 * A barbearia tem acesso liberado (cadastro, agenda, página pública)?
 * - aguardando pagamento / cancelada / sem assinatura / suspensa: não
 * - teste grátis: até o fim do teste (+ folga)
 * - assinatura ativa: sempre
 * - em atraso: durante a tolerância
 */
export function canTakeBookings(i: AccessInput): boolean {
  const now = (i.now ?? new Date()).getTime();
  if (i.tenantStatus !== "ACTIVE") return false;

  switch (i.subscriptionStatus) {
    case "ACTIVE":
      return true;
    case "TRIALING":
      return now < i.trialEndsAt.getTime() + TRIAL_BUFFER_HOURS * 3_600_000;
    case "PAST_DUE":
      return i.currentPeriodEnd
        ? now < i.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000
        : false;
    default:
      return false;
  }
}

/** Precisa cadastrar o cartão? (conta nova, ou conta de teste antiga sem assinatura no gateway) */
export function needsPaymentSetup(i: {
  status: AccessInput["subscriptionStatus"];
  hasGateway: boolean;
}): boolean {
  return i.status === "PENDING_PAYMENT" || (i.status === "TRIALING" && !i.hasGateway);
}
