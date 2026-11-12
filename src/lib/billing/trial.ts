import { addDays, localDateOf, zonedToUtc } from "../availability/tz";
import { TRIAL_DAYS } from "./plan";

const DAY_MS = 86_400_000;

/**
 * O Asaas recebe nextDueDate como data, sem horário. Agenda a primeira cobrança
 * no mínimo 7×24h após o início do checkout; a precisão diária pode acrescentar
 * quase um dia. O fim local do trial coincide com essa data de vencimento.
 */
export function trialSchedule(startedAt: Date): { firstChargeDate: string; trialEndsAt: Date } {
  let firstChargeDate = addDays(localDateOf(startedAt), TRIAL_DAYS + 1);
  let trialEndsAt = zonedToUtc(firstChargeDate, "00:00");

  // Protege o mínimo de 168 horas também se as regras locais de fuso mudarem.
  while (trialEndsAt.getTime() < startedAt.getTime() + TRIAL_DAYS * DAY_MS) {
    firstChargeDate = addDays(firstChargeDate, 1);
    trialEndsAt = zonedToUtc(firstChargeDate, "00:00");
  }

  return { firstChargeDate, trialEndsAt };
}
