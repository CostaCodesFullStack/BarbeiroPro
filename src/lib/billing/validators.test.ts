import { describe, expect, it } from "vitest";
import { isValidCnpj, isValidCpf, isValidCpfCnpj, isValidLuhn } from "./validators";

describe("validators", () => {
  it("CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224726")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });

  it("CPF ou CNPJ", () => {
    expect(isValidCpfCnpj("52998224725")).toBe(true);
    expect(isValidCpfCnpj("11222333000181")).toBe(true);
    expect(isValidCpfCnpj("12345678901")).toBe(false);
  });

  it("Luhn", () => {
    expect(isValidLuhn("4111 1111 1111 1111")).toBe(true);
    expect(isValidLuhn("4111111111111112")).toBe(false);
    expect(isValidLuhn("1234")).toBe(false);
  });
});
