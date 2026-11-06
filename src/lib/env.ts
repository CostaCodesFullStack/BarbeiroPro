import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET precisa ter no minimo 32 caracteres"),
  // Cobrança (Asaas). Opcionais para o app subir sem elas; as rotas de cobrança exigem.
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_BASE_URL: z.string().url().optional(),
  ASAAS_WEBHOOK_TOKEN: z.string().min(16).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Valida as variaveis na primeira leitura (lazy, para nao quebrar o build). */
export function getEnv(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
