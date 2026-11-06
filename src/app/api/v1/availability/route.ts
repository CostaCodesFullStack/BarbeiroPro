import { z } from "zod";
import { ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { getAvailableSlots } from "@/lib/availability/service";
import { isValidDate } from "@/lib/availability/tz";
import { withTenant } from "@/lib/db";

const query = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().refine(isValidDate, "Use o formato YYYY-MM-DD com uma data valida"),
});

/** GET /api/v1/availability?professionalId=&serviceId=&date=YYYY-MM-DD */
export const GET = route(async (req: Request) => {
  const session = await requireAuth();
  const params = query.parse(Object.fromEntries(new URL(req.url).searchParams));

  const result = await withTenant(session.tenantId, (tx) => getAvailableSlots(tx, params));
  return ok(result);
});
