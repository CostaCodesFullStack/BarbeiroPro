import { ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  const session = await requireAuth();

  const [user, tenant] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { id: true, name: true, email: true },
    }),
    prisma.tenant.findUniqueOrThrow({
      where: { id: session.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        trialEndsAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
    }),
  ]);

  return ok({ user, tenant, role: session.role });
});
