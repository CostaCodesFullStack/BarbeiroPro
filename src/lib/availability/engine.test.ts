import { describe, expect, it } from "vitest";
import { computeSlots } from "./engine";
import { dayRange, isValidDate, localDateOf, weekdayOf, zonedToUtc } from "./tz";

const DATE = "2026-11-02"; // segunda-feira
const WORK = { startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00" };
const LONG_BEFORE = new Date("2026-11-01T12:00:00Z");
const iso = (a: Date[]) => a.map((d) => d.toISOString());
const local = (hhmm: string) => zonedToUtc(DATE, hhmm);

describe("tz", () => {
  it("converte horario de Sao Paulo (UTC-3) para UTC", () => {
    expect(zonedToUtc(DATE, "09:00").toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });

  it("calcula o inicio e o fim do dia local", () => {
    const r = dayRange(DATE);
    expect(r.start.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-03T03:00:00.000Z");
  });

  it("descobre o dia local de um instante UTC", () => {
    expect(localDateOf(new Date("2026-11-03T02:30:00Z"))).toBe("2026-11-02"); // 23:30 local
    expect(localDateOf(new Date("2026-11-03T03:00:00Z"))).toBe("2026-11-03"); // meia-noite local
  });

  it("dia da semana e validacao de data", () => {
    expect(weekdayOf(DATE)).toBe(1);
    expect(isValidDate(DATE)).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("02/11/2026")).toBe(false);
  });
});

describe("computeSlots", () => {
  it("gera todos os horarios de um dia livre, pulando o intervalo", () => {
    const slots = iso(computeSlots({ date: DATE, workDay: WORK, durationMin: 30, busy: [], now: LONG_BEFORE }));
    expect(slots).toHaveLength(16);
    expect(slots[0]).toBe("2026-11-02T12:00:00.000Z"); // 09:00
    expect(slots[slots.length - 1]).toBe("2026-11-02T20:30:00.000Z"); // 17:30
    expect(slots).toContain("2026-11-02T14:30:00.000Z"); // 11:30
    expect(slots).not.toContain("2026-11-02T15:00:00.000Z"); // 12:00 (pausa)
    expect(slots).not.toContain("2026-11-02T15:30:00.000Z"); // 12:30 (pausa)
    expect(slots).toContain("2026-11-02T16:00:00.000Z"); // 13:00
  });

  it("devolve vazio quando o profissional nao trabalha no dia", () => {
    expect(computeSlots({ date: DATE, workDay: null, durationMin: 30, busy: [], now: LONG_BEFORE })).toEqual([]);
  });

  it("remove horarios que colidem com algo ocupado", () => {
    const busy = [{ start: local("10:00"), end: local("10:30") }];
    const slots = iso(computeSlots({ date: DATE, workDay: WORK, durationMin: 60, busy, now: LONG_BEFORE }));
    const morning = slots.filter((s) => s < "2026-11-02T15:00:00.000Z");
    // 09:00 ok (termina 10:00), 09:30 e 10:00 colidem, 10:30 ok (comeca quando termina o ocupado), 11:00 ok
    expect(morning).toEqual([
      "2026-11-02T12:00:00.000Z",
      "2026-11-02T13:30:00.000Z",
      "2026-11-02T14:00:00.000Z",
    ]);
  });

  it("nao deixa o servico atravessar o intervalo de pausa", () => {
    const slots = iso(computeSlots({ date: DATE, workDay: WORK, durationMin: 60, busy: [], now: LONG_BEFORE }));
    expect(slots).not.toContain("2026-11-02T14:30:00.000Z"); // 11:30 terminaria 12:30
    expect(slots).toContain("2026-11-02T14:00:00.000Z"); // 11:00 termina 12:00
  });

  it("nao oferece horarios que ja passaram", () => {
    const now = new Date("2026-11-02T13:10:00Z"); // 10:10 local
    const slots = computeSlots({ date: DATE, workDay: WORK, durationMin: 30, busy: [], now });
    expect(slots[0].toISOString()).toBe("2026-11-02T13:30:00.000Z"); // 10:30
    expect(slots).toHaveLength(13);
  });

  it("devolve vazio para um dia que ja acabou", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(computeSlots({ date: DATE, workDay: WORK, durationMin: 30, busy: [], now })).toEqual([]);
  });

  it("respeita a antecedencia minima", () => {
    const now = new Date("2026-11-02T12:00:00Z"); // 09:00 local
    const slots = computeSlots({ date: DATE, workDay: WORK, durationMin: 30, busy: [], now, minNoticeMin: 60 });
    expect(slots[0].toISOString()).toBe("2026-11-02T13:00:00.000Z"); // 10:00
  });
});
