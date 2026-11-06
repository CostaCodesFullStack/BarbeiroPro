import { TZ, zonedToUtc } from "./tz";

export type Interval = { start: Date; end: Date };

export type WorkDay = {
  startTime: string; // "HH:mm"
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
};

export type ComputeSlotsInput = {
  /** Dia local no formato YYYY-MM-DD. */
  date: string;
  /** Expediente do profissional naquele dia da semana (null = nao trabalha). */
  workDay: WorkDay | null;
  durationMin: number;
  /** Intervalos ocupados: agendamentos ativos e bloqueios. */
  busy: Interval[];
  now: Date;
  /** Espacamento entre inicios de horarios, a partir da abertura. */
  stepMin?: number;
  /** Antecedencia minima a partir de `now`. */
  minNoticeMin?: number;
  tz?: string;
};

/**
 * Funcao PURA: devolve os inicios (em UTC) dos horarios livres do dia.
 * Um horario so e valido se o servico inteiro cabe no expediente, fora do intervalo
 * de pausa, sem tocar em nada ocupado e respeitando a antecedencia minima.
 */
export function computeSlots(input: ComputeSlotsInput): Date[] {
  const { date, workDay, durationMin, busy, now, stepMin = 30, minNoticeMin = 0, tz = TZ } = input;
  if (!workDay) return [];

  const at = (hhmm: string) => zonedToUtc(date, hhmm, tz);
  const open = at(workDay.startTime);
  const close = at(workDay.endTime);

  const windows: Interval[] =
    workDay.breakStart && workDay.breakEnd
      ? [
          { start: open, end: at(workDay.breakStart) },
          { start: at(workDay.breakEnd), end: close },
        ]
      : [{ start: open, end: close }];

  const durMs = durationMin * 60_000;
  const stepMs = stepMin * 60_000;
  const earliest = now.getTime() + minNoticeMin * 60_000;

  const slots: Date[] = [];
  for (const w of windows) {
    for (let t = w.start.getTime(); t + durMs <= w.end.getTime(); t += stepMs) {
      if (t < earliest) continue;
      const end = t + durMs;
      const clashes = busy.some((b) => t < b.end.getTime() && end > b.start.getTime());
      if (!clashes) slots.push(new Date(t));
    }
  }
  return slots;
}
