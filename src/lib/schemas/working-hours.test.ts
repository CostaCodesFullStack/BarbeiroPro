import { describe, expect, it } from "vitest";
import { workingHoursSchema } from "./working-hours";

const ok = { weekday: 1, startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00" };

describe("workingHoursSchema", () => {
  it("aceita expediente valido com intervalo", () => {
    expect(workingHoursSchema.safeParse({ days: [ok] }).success).toBe(true);
  });

  it("aceita dia sem intervalo", () => {
    const { breakStart, breakEnd, ...semIntervalo } = ok;
    expect(workingHoursSchema.safeParse({ days: [semIntervalo] }).success).toBe(true);
  });

  it("rejeita inicio depois do fim", () => {
    expect(workingHoursSchema.safeParse({ days: [{ ...ok, startTime: "19:00" }] }).success).toBe(false);
  });

  it("rejeita intervalo fora do expediente", () => {
    expect(workingHoursSchema.safeParse({ days: [{ ...ok, breakStart: "07:00", breakEnd: "08:00" }] }).success).toBe(false);
  });

  it("rejeita intervalo incompleto", () => {
    expect(workingHoursSchema.safeParse({ days: [{ ...ok, breakEnd: null }] }).success).toBe(false);
  });

  it("rejeita hora em formato invalido", () => {
    expect(workingHoursSchema.safeParse({ days: [{ ...ok, startTime: "9h" }] }).success).toBe(false);
  });

  it("rejeita dia da semana repetido", () => {
    expect(workingHoursSchema.safeParse({ days: [ok, ok] }).success).toBe(false);
  });
});
