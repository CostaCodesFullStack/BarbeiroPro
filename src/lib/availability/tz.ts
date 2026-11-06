/** Fuso padrao do sistema. Futuramente pode virar uma coluna em `tenants`. */
export const TZ = "America/Sao_Paulo";

/** Diferenca (em minutos) entre o horario local do fuso e UTC, no instante dado. */
function offsetMinutes(instantMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60000);
}

/** Converte "2026-11-02" + "09:00" (horario local do fuso) em um instante UTC. */
export function zonedToUtc(date: string, hhmm: string, tz: string = TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess - offsetMinutes(guess, tz) * 60000;
  utc = guess - offsetMinutes(utc, tz) * 60000; // segunda passada cobre mudancas de horario
  return new Date(utc);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Dia da semana do calendario: 0 = domingo ... 6 = sabado. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Inicio (inclusivo) e fim (exclusivo) do dia local, em UTC. */
export function dayRange(date: string, tz: string = TZ): { start: Date; end: Date } {
  return { start: zonedToUtc(date, "00:00", tz), end: zonedToUtc(addDays(date, 1), "00:00", tz) };
}

/** Dia local (YYYY-MM-DD) em que um instante UTC cai no fuso. */
export function localDateOf(instant: Date, tz: string = TZ): string {
  // O locale en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
