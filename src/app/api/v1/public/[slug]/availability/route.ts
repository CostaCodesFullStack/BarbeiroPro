import { ok, route } from "@/lib/api";
import { getAvailableSlots } from "@/lib/availability/service";
import { withTenant } from "@/lib/db";
import { PUBLIC_MIN_NOTICE_MIN } from "@/lib/public/config";
import { assertWithinHorizon, enforceRateLimit, getBookableTenant } from "@/lib/public/guard";
import { clientIp } from "@/lib/rate-limit";
import { publicAvailabilityQuery } from "@/lib/schemas/appointment";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/v1/public/:slug/availability?professionalId=&serviceId=&date=YYYY-MM-DD */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  enforceRateLimit(`pub-slots:${clientIp(req)}`, 120, 60_000);

  const q = publicAvailabilityQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  assertWithinHorizon(q.date);
  const tenant = await getBookableTenant(slug);

  const result = await withTenant(tenant.id, (tx) =>
    getAvailableSlots(tx, { ...q, minNoticeMin: PUBLIC_MIN_NOTICE_MIN }),
  );
  return ok(result);
});
