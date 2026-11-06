import { z } from "zod";
import { atLeastOne } from "./common";

const base = z.object({
  name: z.string().trim().min(2).max(100),
  durationMin: z.number().int().min(5).max(480),
  priceCents: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
});

export const serviceCreateSchema = base.partial({ active: true });
export const serviceUpdateSchema = atLeastOne(base.partial());
