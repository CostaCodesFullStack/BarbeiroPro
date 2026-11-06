import { z } from "zod";
import { isValidDate } from "@/lib/availability/tz";

const instant = z
  .string()
  .datetime({ offset: true, message: "Use data e hora ISO 8601, ex.: 2026-11-02T09:00:00-03:00" })
  .transform((s) => new Date(s));

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(10, "Telefone invalido").max(13, "Telefone invalido"));

export const appointmentCreateSchema = z
  .object({
    professionalId: z.string().uuid(),
    serviceId: z.string().uuid(),
    startAt: instant,
    clientId: z.string().uuid().optional(),
    client: z
      .object({
        name: z.string().trim().min(2).max(100),
        phone,
        email: z.string().trim().toLowerCase().email().max(200).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.clientId) !== Boolean(v.client), {
    message: "Informe clientId OU client (nome e telefone), nao os dois",
    path: ["client"],
  });

export const appointmentListQuery = z.object({
  date: z.string().refine(isValidDate, "Use o formato YYYY-MM-DD com uma data valida"),
  professionalId: z.string().uuid().optional(),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"]),
});

const publicClient = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  phone,
});

/** Agendamento feito pelo cliente final na página pública. */
export const publicAppointmentSchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: instant,
  client: publicClient,
});

export const publicAvailabilityQuery = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().refine(isValidDate, "Use o formato YYYY-MM-DD com uma data válida"),
});
