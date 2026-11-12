import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import CheckoutClient from "@/components/CheckoutClient";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
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
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            accessEndsAt: true,
            cancellationConfirmed: true,
            gatewaySubscriptionId: true,
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);
  if (!tenant) redirect("/login");

  const sub = tenant.subscription;
  const status = sub?.status ?? null;
  const canSubscribe = can(session.role, "subscription:manage");
  const canConfigure = can(session.role, "services:manage") || can(session.role, "professionals:manage");

  // Conta nova (ou de teste antiga): nada é liberado até o cartão ser cadastrado.
  if (needsPaymentSetup({ status, hasGateway: Boolean(sub?.gatewaySubscriptionId) })) {
    return (
      <div className="container">
        <div className="header">
          <h2 style={{ margin: 0 }}>{tenant.name}</h2>
          <LogoutButton />
        </div>
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
    accessEndsAt: sub?.accessEndsAt ?? null,
    cancellationConfirmed: sub?.cancellationConfirmed ?? false,
  });
  const daysLeft = Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / 86_400_000);
  const cancelPending = Boolean(sub?.accessEndsAt && !sub.cancellationConfirmed);
  const cancelScheduled = Boolean(sub?.accessEndsAt && sub.cancellationConfirmed && access);
  const cancelEnded = Boolean(
    sub?.accessEndsAt && sub.cancellationConfirmed && Date.now() >= sub.accessEndsAt.getTime(),
  );

  return (
    <div className="dashboard-theme">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href="/painel" aria-label="BarbeiroPro, agenda">
          Barbeiro<span>Pro</span>
        </Link>
        <PainelNav canConfigure={canConfigure} canSubscribe={canSubscribe} />
      </aside>
      <div className="dashboard-main">
        <DashboardHeader tenantName={tenant.name} />
        <main className="dashboard-content">
          {status === "TRIALING" && access && (
            <div className="banner">
              Teste grátis até {day(tenant.trialEndsAt)} ({Math.max(daysLeft, 0)} {daysLeft === 1 ? "dia restante" : "dias restantes"}).
              {sub?.currentPeriodEnd ? ` Primeira cobrança prevista para ${day(sub.currentPeriodEnd)}.` : ""}
            </div>
          )}
          {status === "PAST_DUE" && access && (
            <div className="banner">Não conseguimos cobrar sua assinatura. Regularize para evitar o bloqueio do painel.</div>
          )}
          {!access && (
            <div className="banner" role="alert">
              {cancelEnded && sub?.accessEndsAt
                ? `Assinatura encerrada. Seu acesso terminou em ${day(sub.accessEndsAt)}; os dados foram preservados.`
                : "Assinatura inativa: o painel está somente para consulta e a página de agendamento está fora do ar."}
            </div>
          )}
          {cancelPending && (
            <div className="banner" role="alert">
              A solicitação de cancelamento ainda não foi confirmada pelo Asaas. O cancelamento não está concluído.
            </div>
          )}
          {cancelScheduled && sub?.accessEndsAt && (
            <div className="banner">
              Renovação cancelada. Você mantém o acesso até {day(sub.accessEndsAt)}; depois, o painel ficará somente para consulta e o agendamento público será encerrado.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
