import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    // Carrega o .env para os testes de integracao (que usam o banco local).
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
