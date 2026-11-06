import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import CheckoutClient from "@/components/CheckoutClient";
import LogoutButton from "@/components/LogoutButton";
import PainelNav from "@/components/PainelNav";
import { getSession } from "@/lib/auth/session";
import { canTakeBookings, needsPaymentSetup } from "@/lib/billing/access";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        name: true,
        status: true,
        trialEndsAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true, gatewaySubscriptionId: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);
  if (!tenant) redirect("/login");

  const sub = tenant.subscription;
  const status = sub?.status ?? null;
  const canSubscribe = can(session.role, "subscription:manage");
  const canConfigure = can(session.role, "services:manage") || can(session.role, "professionals:manage");

  const header = (
    <div className="header">
      <h2 style={{ margin: 0 }}>{tenant.name}</h2>
      <LogoutButton />
    </div>
  );

  // Conta nova (ou de teste antiga): nada é liberado até o cartão ser cadastrado.
  if (needsPaymentSetup({ status, hasGateway: Boolean(sub?.gatewaySubscriptionId) })) {
    return (
      <div className="container">
        {header}
        {canSubscribe ? (
          <CheckoutClient defaultName={user?.name ?? ""} />
        ) : (
          <div className="card">
            <h3>Aguardando ativação</h3>
            <p className="muted">O proprietário da barbearia precisa ativar a assinatura para liberar o sistema.</p>
          </div>
        )}
      </div>
    );
  }

  const access = canTakeBookings({
    tenantStatus: tenant.status,
    subscriptionStatus: status,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  });
  const daysLeft = Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / 86_400_000);

  return (
    <div className="container">
      {header}
      {status === "TRIALING" && access && (
        <div className="banner">
          Teste grátis: {Math.max(daysLeft, 0)} {daysLeft === 1 ? "dia restante" : "dias restantes"}.
          {sub?.currentPeriodEnd ? ` Primeira cobrança em ${day(sub.currentPeriodEnd)}.` : ""}
        </div>
      )}
      {status === "PAST_DUE" && access && (
        <div className="banner">Não conseguimos cobrar sua assinatura. Regularize para evitar o bloqueio do painel.</div>
      )}
      {!access && (
        <div className="banner" role="alert">
          Assinatura inativa: o painel está somente para consulta e a página de agendamento está fora do ar.
        </div>
      )}
      <PainelNav canConfigure={canConfigure} canSubscribe={canSubscribe} />
      {children}
    </div>
  );
}
