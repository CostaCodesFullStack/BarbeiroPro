export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** fetch para a API interna: desembrulha { data } e converte { error } em ApiError. */
export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const isAuthRoute = path.startsWith("/api/v1/auth/");
    if (res.status === 401 && !isAuthRoute && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    // Erros de validação trazem os motivos por campo: mostra o primeiro para a pessoa saber o que corrigir.
    const details = json?.error?.details as Record<string, string[] | undefined> | undefined;
    const firstReason =
      details && typeof details === "object" ? Object.values(details).flat().find(Boolean) : undefined;
    const base: string = json?.error?.message ?? "Erro inesperado. Tente novamente.";

    throw new ApiError(
      res.status,
      json?.error?.code ?? "ERROR",
      firstReason ? `${base}: ${firstReason}` : base,
    );
  }
  return json.data as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado";
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayInSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** "50,00" -> 5000 | "1.250,50" -> 125050 | "50.5" -> 5050 | invalido -> null */
export function parseBRLToCents(input: string): number | null {
  let t = input.trim().replace(/[^\d.,]/g, "");
  if (!t) return null;
  t = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** 5000 -> "50,00" */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
