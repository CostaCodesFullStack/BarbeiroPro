import { z } from "zod";

const instant = z
  .string()
  .datetime({ offset: true, message: "Use data e hora ISO 8601, ex.: 2026-11-02T12:00:00-03:00" })
  .transform((s) => new Date(s));

const MAX_BLOCK_MS = 31 * 24 * 60 * 60 * 1000;

export const timeBlockCreateSchema = z
  .object({
    startAt: instant,
    endAt: instant,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.endAt > v.startAt, { message: "endAt deve ser depois de startAt", path: ["endAt"] })
  .refine((v) => v.endAt.getTime() - v.startAt.getTime() <= MAX_BLOCK_MS, {
    message: "O bloqueio nao pode passar de 31 dias",
    path: ["endAt"],
  });

export const timeBlockListQuery = z.object({
  from: instant.optional(),
  to: instant.optional(),
});
