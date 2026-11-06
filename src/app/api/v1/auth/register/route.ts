import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError, ok, readJson, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(72), // 72 = limite do bcrypt
  barbershopName: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "Use 3 a 40 caracteres: letras minúsculas, números e hífen"),
});

export const POST = route(async (req: Request) => {
  const input = schema.parse(await readJson(req));
  const passwordHash = await hashPassword(input.password);

  try {
    const { user, tenant } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });
      const tenant = await tx.tenant.create({
        // O teste de 7 dias só começa quando o cartão é cadastrado (POST /subscription/checkout).
        data: { name: input.barbershopName, slug: input.slug, trialEndsAt: new Date() },
      });
      await tx.membership.create({
        data: { userId: user.id, tenantId: tenant.id, role: "OWNER" },
      });
      await tx.subscription.create({
        data: { tenantId: tenant.id, status: "PENDING_PAYMENT" },
      });
      return { user, tenant };
    });

    await createSession({ userId: user.id, tenantId: tenant.id, role: "OWNER" });

    return ok(
      {
        user: { id: user.id, name: user.name, email: user.email },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      },
      201,
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String(err.meta?.target ?? "");
      if (target.includes("email")) {
        throw new HttpError(409, "EMAIL_TAKEN", "Este e-mail já está cadastrado");
      }
      if (target.includes("slug")) {
        throw new HttpError(409, "SLUG_TAKEN", "Este endereço de barbearia já está em uso");
      }
    }
    throw err;
  }
});
