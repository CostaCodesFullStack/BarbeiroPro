import { z } from "zod";
import { toMinutes } from "@/lib/time";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:mm");

const day = z
  .object({
    weekday: z.number().int().min(0).max(6), // 0 = domingo
    startTime: time,
    endTime: time,
    breakStart: time.nullish(),
    breakEnd: time.nullish(),
  })
  .superRefine((d, ctx) => {
    const start = toMinutes(d.startTime);
    const end = toMinutes(d.endTime);
    if (start >= end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startTime deve ser antes de endTime",
        path: ["endTime"],
      });
    }
    const hasStart = d.breakStart != null;
    const hasEnd = d.breakEnd != null;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe breakStart e breakEnd juntos",
        path: ["breakStart"],
      });
    } else if (hasStart && hasEnd) {
      const bs = toMinutes(d.breakStart!);
      const be = toMinutes(d.breakEnd!);
      if (!(start <= bs && bs < be && be <= end)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O intervalo deve estar dentro do expediente e ter inicio antes do fim",
          path: ["breakStart"],
        });
      }
    }
  });

export const workingHoursSchema = z
  .object({ days: z.array(day).max(7) })
  .superRefine((v, ctx) => {
    const days = v.days.map((d) => d.weekday);
    if (new Set(days).size !== days.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "weekday repetido", path: ["days"] });
    }
  });
