import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("permissions", () => {
  it("somente o dono gerencia a assinatura", () => {
    expect(can("OWNER", "subscription:manage")).toBe(true);
    expect(can("MANAGER", "subscription:manage")).toBe(false);
    expect(can("BARBER", "subscription:manage")).toBe(false);
    expect(can("RECEPTION", "subscription:manage")).toBe(false);
  });

  it("financeiro: dono e gerente apenas", () => {
    expect(can("OWNER", "finance:read")).toBe(true);
    expect(can("MANAGER", "finance:read")).toBe(true);
    expect(can("BARBER", "finance:read")).toBe(false);
    expect(can("RECEPTION", "finance:read")).toBe(false);
  });

  it("barbeiro ve apenas a propria agenda e as proprias comissoes", () => {
    expect(can("BARBER", "agenda:read:own")).toBe(true);
    expect(can("BARBER", "agenda:read:all")).toBe(false);
    expect(can("BARBER", "commissions:read:own")).toBe(true);
    expect(can("BARBER", "commissions:read:all")).toBe(false);
  });

  it("recepcao gerencia agenda de todos, mas nao ve comissoes", () => {
    expect(can("RECEPTION", "agenda:read:all")).toBe(true);
    expect(can("RECEPTION", "agenda:write:all")).toBe(true);
    expect(can("RECEPTION", "commissions:read:own")).toBe(false);
  });

  it("todos podem ver clientes", () => {
    for (const role of ["OWNER", "MANAGER", "BARBER", "RECEPTION"] as const) {
      expect(can(role, "clients:read")).toBe(true);
    }
  });
});
