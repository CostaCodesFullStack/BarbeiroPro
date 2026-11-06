import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "./rate-limit";

afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("bloqueia depois do limite e libera quando a janela passa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));

    expect(rateLimit("t-janela", 2, 60_000).allowed).toBe(true);
    expect(rateLimit("t-janela", 2, 60_000).allowed).toBe(true);
    const blocked = rateLimit("t-janela", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    vi.setSystemTime(new Date("2026-11-02T12:01:01Z"));
    expect(rateLimit("t-janela", 2, 60_000).allowed).toBe(true);
  });

  it("chaves diferentes não interferem entre si", () => {
    expect(rateLimit("t-a", 1, 60_000).allowed).toBe(true);
    expect(rateLimit("t-a", 1, 60_000).allowed).toBe(false);
    expect(rateLimit("t-b", 1, 60_000).allowed).toBe(true);
  });
});
