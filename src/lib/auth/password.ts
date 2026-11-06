import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Hash valido usado para igualar o tempo de resposta quando o e-mail nao existe. */
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", ROUNDS);
