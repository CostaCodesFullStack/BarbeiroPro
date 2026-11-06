import { z } from "zod";
import { atLeastOne } from "./common";

const base = z.object({
  name: z.string().trim().min(2).max(100),
  // basis points: 3000 = 30,00%
  commissionBps: z.number().int().min(0).max(10_000),
  active: z.boolean(),
});

export const professionalCreateSchema = base.partial({ commissionBps: true, active: true });
export const professionalUpdateSchema = atLeastOne(base.partial());

export const professionalServicesSchema = z
  .object({
    services: z
      .array(
        z.object({
          serviceId: z.string().uuid(),
          customPriceCents: z.number().int().min(0).max(1_000_000).nullish(),
        }),
      )
      .max(100),
  })
  .superRefine((v, ctx) => {
    const ids = v.services.map((s) => s.serviceId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "serviceId repetido", path: ["services"] });
    }
  });
