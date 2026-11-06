import { z } from "zod";

export const idParam = z.object({ id: z.string().uuid() });

/** Exige ao menos um campo no PATCH. */
export function atLeastOne<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (v) => Object.values(v as Record<string, unknown>).some((x) => x !== undefined),
    { message: "Informe ao menos um campo para atualizar" },
  );
}
