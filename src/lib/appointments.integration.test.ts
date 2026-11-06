import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant } from "./db";

/** Prova que o BANCO impede dois agendamentos sobrepostos do mesmo profissional. */
const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("constraint anti-sobreposicao de agendamentos", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  let tenantId = "";
  let professionalId = "";
  let otherProfessionalId = "";
  let serviceId = "";
  let clientId = "";

  const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00Z`);

  const book = (start: string, end: string, pro = professionalId) =>
    withTenant(tenantId, (tx) =>
      tx.appointment.create({
        data: {
          tenantId,
          clientId,
          professionalId: pro,
          serviceId,
          startAt: at(start),
          endAt: at(end),
          priceCents: 5000,
        },
      }),
    );

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: { name: "Teste Agenda", slug: `agenda-${suffix}`, trialEndsAt: new Date(Date.now() + 86_400_000) },
    });
    tenantId = tenant.id;
    await withTenant(tenantId, async (tx) => {
      professionalId = (await tx.professional.create({ data: { tenantId, name: "Pro 1" } })).id;
      otherProfessionalId = (await tx.professional.create({ data: { tenantId, name: "Pro 2" } })).id;
      serviceId = (
        await tx.service.create({ data: { tenantId, name: "Corte", durationMin: 30, priceCents: 5000 } })
      ).id;
      clientId = (await tx.client.create({ data: { tenantId, name: "Cliente", phone: "11999990000" } })).id;
    });
  });

  afterAll(async () => {
    // Remove o tenant inteiro (cascata). Agendamentos referenciam profissional/servico/cliente sem cascata,
    // entao limpamos antes.
    await withTenant(tenantId, (tx) => tx.appointment.deleteMany({}));
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("aceita o primeiro agendamento", async () => {
    await expect(book("13:00", "13:30")).resolves.toBeTruthy();
  });

  it("recusa agendamento que sobrepoe o mesmo profissional", async () => {
    await expect(book("13:15", "13:45")).rejects.toThrow();
  });

  it("aceita horario colado (comeca quando o outro termina)", async () => {
    await expect(book("13:30", "14:00")).resolves.toBeTruthy();
  });

  it("aceita o mesmo horario para OUTRO profissional", async () => {
    await expect(book("13:00", "13:30", otherProfessionalId)).resolves.toBeTruthy();
  });

  it("agendamento cancelado libera o horario", async () => {
    await withTenant(tenantId, (tx) =>
      tx.appointment.updateMany({
        where: { professionalId, startAt: at("13:00") },
        data: { status: "CANCELED" },
      }),
    );
    await expect(book("13:00", "13:30")).resolves.toBeTruthy();
  });

  it("duas tentativas simultaneas no mesmo horario: so uma vence", async () => {
    const results = await Promise.allSettled([book("15:00", "15:30"), book("15:00", "15:30")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});
