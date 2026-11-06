import { z } from "zod";
import { isValidCpfCnpj, isValidLuhn } from "@/lib/billing/validators";

const digits = (s: string) => s.replace(/\D/g, "");

export const checkoutSchema = z
  .object({
    card: z.object({
      holderName: z.string().trim().min(2, "Informe o nome impresso no cartão").max(60),
      number: z
        .string()
        .transform(digits)
        .refine(isValidLuhn, "Número do cartão inválido"),
      expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Mês inválido (01 a 12)"),
      expiryYear: z.string().regex(/^20\d{2}$/, "Ano inválido (ex.: 2029)"),
      ccv: z.string().regex(/^\d{3,4}$/, "Código de segurança inválido"),
    }),
    holder: z.object({
      name: z.string().trim().min(2).max(100),
      cpfCnpj: z.string().transform(digits).refine(isValidCpfCnpj, "CPF ou CNPJ inválido"),
      postalCode: z.string().transform(digits).pipe(z.string().length(8, "CEP deve ter 8 dígitos")),
      addressNumber: z.string().trim().min(1, "Informe o número do endereço").max(10),
      phone: z.string().transform(digits).pipe(z.string().min(10, "Telefone inválido").max(11, "Telefone inválido")),
    }),
  })
  .superRefine((v, ctx) => {
    const now = new Date();
    const year = Number(v.card.expiryYear);
    const month = Number(v.card.expiryMonth);
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cartão vencido", path: ["card", "expiryYear"] });
    }
  });
