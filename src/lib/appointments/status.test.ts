import { describe, expect, it } from "vitest";
import { canTransition } from "./status";

describe("canTransition", () => {
  it("permite o fluxo normal", () => {
    expect(canTransition("SCHEDULED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransition("SCHEDULED", "CANCELED")).toBe(true);
    expect(canTransition("CONFIRMED", "NO_SHOW")).toBe(true);
  });

  it("nao volta para tras", () => {
    expect(canTransition("CONFIRMED", "SCHEDULED")).toBe(false);
    expect(canTransition("COMPLETED", "SCHEDULED")).toBe(false);
  });

  it("estados finais nao mudam", () => {
    for (const final of ["COMPLETED", "CANCELED", "NO_SHOW"] as const) {
      for (const to of ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"] as const) {
        expect(canTransition(final, to)).toBe(false);
      }
    }
  });
});
