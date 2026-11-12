import { HttpError } from "@/lib/api";
import { canTakeBookings } from "@/lib/billing/access";
import { prisma } from "@/lib/db";
import { can, type Action } from "@/lib/permissions";
import { getSession, type Session } from "./session";

/**
 * Exige usuario logado e, opcionalmente, uma permissao.
 * Uso: const session = await requireAuth("finance:read");
 */
export async function requireAuth(action?: Action): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "UNAUTHENTICATED", "Faca login para continuar");
  if (action && !can(session.role, action)) {
    throw new HttpError(403, "FORBIDDEN", "Voce nao tem permissao para esta acao");
  }
  return session;
}

/**
 * Quem pode alterar a agenda de um profissional:
 * dono, gerente e recepcao (agenda:write:all) ou o proprio barbeiro (agenda:write:own).
 */
export function assertAgendaWrite(session: Session, professional: { userId: string | null }): void {
  if (can(session.role, "agenda:write:all")) return;
  if (can(session.role, "agenda:write:own") && professional.userId === session.userId) return;
  throw new HttpError(403, "FORBIDDEN", "Voce nao tem permissao para alterar esta agenda");
}

/**
 * Como requireAuth, mas para operações que ALTERAM dados: exige que a barbearia tenha
 * acesso liberado (teste vigente, assinatura ativa ou em atraso dentro da tolerância).
 * Sem isso, 402 — o painel fica somente leitura. Nunca apaga dados.
 */
export async function requireWriteAuth(action?: Action): Promise<Session> {
  const session = await requireAuth(action);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      status: true,
      trialEndsAt: true,
      subscription: { select: { status: true, currentPeriodEnd: true, accessEndsAt: true, cancellationConfirmed: true } },
    },
  });

  const allowed =
    tenant !== null &&
    canTakeBookings({
      tenantStatus: tenant.status,
      subscriptionStatus: tenant.subscription?.status ?? null,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.subscription?.currentPeriodEnd ?? null,
      accessEndsAt: tenant.subscription?.accessEndsAt ?? null,
      cancellationConfirmed: tenant.subscription?.cancellationConfirmed ?? false,
    });

  if (!allowed) {
    throw new HttpError(402, "PAYMENT_REQUIRED", "Ative sua assinatura para continuar cadastrando.");
  }
  return session;
}
