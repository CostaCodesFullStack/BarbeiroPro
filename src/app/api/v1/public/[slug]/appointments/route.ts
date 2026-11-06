import { ok, readJson, route } from "@/lib/api";
import { createAppointment } from "@/lib/appointments/create";
import { localDateOf } from "@/lib/availability/tz";
import {
  PUBLIC_MAX_ACTIVE_PER_CLIENT,
  PUBLIC_MIN_NOTICE_MIN,
} from "@/lib/public/config";
import { assertWithinHorizon, enforceRateLimit, getBookableTenant } from "@/lib/public/guard";
import { clientIp } from "@/lib/rate-limit";
import { publicAppointmentSchema } from "@/lib/schemas/appointment";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/v1/public/:slug/appointments — o cliente final agenda sem login. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  enforceRateLimit(`pub-book-ip:${clientIp(req)}`, 10, 3_600_000);

  const input = publicAppointmentSchema.parse(await readJson(req));
  // Mesmo telefone não pode disparar tentativas em excesso, mesmo trocando de IP.
  enforceRateLimit(`pub-book-phone:${input.client.phone}`, 5, 3_600_000);

  assertWithinHorizon(localDateOf(input.startAt));
  const tenant = await getBookableTenant(slug);

  const appointment = await createAppointment({
    tenantId: tenant.id,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    startAt: input.startAt,
    client: input.client,
    source: "ONLINE",
    minNoticeMin: PUBLIC_MIN_NOTICE_MIN,
    maxActivePerClient: PUBLIC_MAX_ACTIVE_PER_CLIENT,
  });

  // Resposta mínima: não devolve dados de cadastro além do necessário para a confirmação.
  return ok(
    {
      appointment: {
        id: appointment.id,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        priceCents: appointment.priceCents,
        service: { name: appointment.service.name },
        professional: { name: appointment.professional.name },
      },
      tenant: { name: tenant.name, phone: tenant.phone, address: tenant.address },
    },
    201,
  );
});
