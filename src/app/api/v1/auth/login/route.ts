import { z } from "zod";
import { HttpError, ok, readJson, route } from "@/lib/api";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const POST = route(async (req: Request) => {
  const input = schema.parse(await readJson(req));

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      memberships: {
        where: { tenant: { status: "ACTIVE" } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  // Sempre compara hash, mesmo sem usuario, para nao vazar existencia por tempo de resposta.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos");
  }

  const membership = user.memberships[0];
  if (!membership) {
    throw new HttpError(403, "NO_ACTIVE_TENANT", "Nenhuma barbearia ativa para este usuário");
  }

  await createSession({
    userId: user.id,
    tenantId: membership.tenantId,
    role: membership.role,
  });

  return ok({ user: { id: user.id, name: user.name, email: user.email } });
});
