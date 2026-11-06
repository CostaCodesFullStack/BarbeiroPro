import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** Envolve um handler: converte erros conhecidos em respostas JSON padronizadas. */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.code, err.message, err.details);
      if (err instanceof ZodError) {
        return fail(422, "VALIDATION_ERROR", "Dados invalidos", err.flatten().fieldErrors);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return fail(404, "NOT_FOUND", "Registro nao encontrado");
      }
      console.error("Unhandled error", err);
      return fail(500, "INTERNAL_ERROR", "Erro interno");
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Corpo da requisicao nao e um JSON valido");
  }
}
