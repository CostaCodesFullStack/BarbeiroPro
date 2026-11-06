import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant } from "./db";

/**
 * Teste de integracao: precisa do Postgres local com `npm run db:setup` ja executado
 * e DATABASE_URL apontando para o app_user (sem superuser). Sem DATABASE_URL, e ignorado.
 */
const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("RLS: isolamento entre barbearias", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  let tenantA = "";
  let tenantB = "";
  let serviceA = "";

  beforeAll(async () => {
    const trialEndsAt = new Date(Date.now() + 7 * 86_400_000);
    const a = await prisma.tenant.create({
      data: { name: "Teste A", slug: `teste-a-${suffix}`, trialEndsAt },
    });
    const b = await prisma.tenant.create({
      data: { name: "Teste B", slug: `teste-b-${suffix}`, trialEndsAt },
    });
    tenantA = a.id;
    tenantB = b.id;

    const s = await withTenant(tenantA, (tx) =>
      tx.service.create({
        data: { tenantId: tenantA, name: "Corte A", durationMin: 30, priceCents: 5000 },
      }),
    );
    serviceA = s.id;
  });

  afterAll(async () => {
    // Apagar o tenant remove os servicos em cascata.
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("a propria barbearia enxerga seus dados", async () => {
    const list = await withTenant(tenantA, (tx) => tx.service.findMany());
    expect(list.map((s) => s.id)).toContain(serviceA);
  });

  it("outra barbearia NAO enxerga os dados", async () => {
    const list = await withTenant(tenantB, (tx) => tx.service.findMany());
    expect(list.map((s) => s.id)).not.toContain(serviceA);
  });

  it("sem tenant definido, nenhuma linha e visivel", async () => {
    const list = await prisma.service.findMany();
    expect(list).toHaveLength(0);
  });

  it("outra barbearia NAO consegue alterar dados alheios", async () => {
    const result = await withTenant(tenantB, (tx) =>
      tx.service.updateMany({ where: { id: serviceA }, data: { name: "Invadido" } }),
    );
    expect(result.count).toBe(0);
  });

  it("nao permite gravar com o tenant_id de outra barbearia", async () => {
    await expect(
      withTenant(tenantB, (tx) =>
        tx.service.create({
          data: { tenantId: tenantA, name: "Intruso", durationMin: 30, priceCents: 1000 },
        }),
      ),
    ).rejects.toThrow();
  });
});
