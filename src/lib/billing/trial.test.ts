import { describe, expect, it } from "vitest";
import { trialSchedule } from "./trial";

const minimumTrial = 7 * 86_400_000;

describe("trialSchedule", () => {
  it("agenda pelo menos 168 horas depois de um cadastro pouco antes da meia-noite", () => {
    const start = new Date("2026-11-09T02:59:00.000Z"); // 08/11 23:59 em São Paulo
    const schedule = trialSchedule(start);

    expect(schedule.firstChargeDate).toBe("2026-11-16");
    expect(schedule.trialEndsAt.toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(schedule.trialEndsAt.getTime() - start.getTime()).toBeGreaterThanOrEqual(minimumTrial);
  });

  it("mantém o mínimo de sete dias para cadastro logo após a meia-noite", () => {
    const start = new Date("2026-11-09T03:01:00.000Z"); // 09/11 00:01 em São Paulo
    const schedule = trialSchedule(start);

    expect(schedule.firstChargeDate).toBe("2026-11-17");
    expect(schedule.trialEndsAt.getTime() - start.getTime()).toBeGreaterThanOrEqual(minimumTrial);
  });

  it("atravessa corretamente mês e ano", () => {
    const start = new Date("2027-01-01T02:59:00.000Z"); // 31/12 23:59 em São Paulo
    const schedule = trialSchedule(start);

    expect(schedule.firstChargeDate).toBe("2027-01-08");
    expect(schedule.trialEndsAt.getTime() - start.getTime()).toBeGreaterThanOrEqual(minimumTrial);
  });
});
