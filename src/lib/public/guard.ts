import { z } from "zod";
import { HttpError } from "@/lib/api";
import { canTakeBookings } from "@/lib/billing/access";
import { addDays, localDateOf } from "@/lib/availability/tz";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { PUBLIC_MAX_DAYS_AHEAD } from "./config";

const slugSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.allowed) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      `Muitas tentativas. Tente novamente em ${r.retryAfterSec} segundos.`,
    );
  }
}

/** Dados mínimos da barbearia + se ela está aceitando agendamentos. null = não existe. */
export async function findPublicTenant(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      status: true,
      trialEndsAt: true,
      subscription: { select: { status: true, currentPeriodEnd: true, accessEndsAt: true, cancellationConfirmed: true } },
    },
  });
  if (!tenant) return null;

  const bookable = canTakeBookings({
    tenantStatus: tenant.status,
    subscriptionStatus: tenant.subscription?.status ?? null,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEnd: tenant.subscription?.currentPeriodEnd ?? null,
    accessEndsAt: tenant.subscription?.accessEndsAt ?? null,
    cancellationConfirmed: tenant.subscription?.cancellationConfirmed ?? false,
  });
  return { ...tenant, bookable };
}

/** Para as rotas de API: 404 se não existe, 403 se não está aceitando agendamentos. */
export async function getBookableTenant(slug: string) {
  const tenant = await findPublicTenant(slug);
  if (!tenant) throw new HttpError(404, "NOT_FOUND", "Barbearia não encontrada");
  if (!tenant.bookable) {
    throw new HttpError(
      403,
      "BOOKING_UNAVAILABLE",
      "Esta barbearia não está aceitando agendamentos online no momento.",
    );
  }
  return tenant;
}

/** Garante que o dia (YYYY-MM-DD) está dentro do horizonte permitido. */
export function assertWithinHorizon(date: string): void {
  const max = addDays(localDateOf(new Date()), PUBLIC_MAX_DAYS_AHEAD);
  if (date > max) {
    throw new HttpError(
      422,
      "TOO_FAR_AHEAD",
      `Só é possível agendar até ${PUBLIC_MAX_DAYS_AHEAD} dias à frente.`,
    );
  }
}
