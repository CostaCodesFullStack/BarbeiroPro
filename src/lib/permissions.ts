export type Role = "OWNER" | "MANAGER" | "BARBER" | "RECEPTION";

export type Action =
  | "subscription:manage"
  | "finance:read"
  | "finance:write"
  | "services:manage"
  | "professionals:manage"
  | "agenda:read:all"
  | "agenda:read:own"
  | "agenda:write:all"
  | "agenda:write:own"
  | "clients:read"
  | "clients:write"
  | "commissions:read:all"
  | "commissions:read:own";

const MATRIX: Record<Role, readonly Action[]> = {
  OWNER: [
    "subscription:manage",
    "finance:read",
    "finance:write",
    "services:manage",
    "professionals:manage",
    "agenda:read:all",
    "agenda:read:own",
    "agenda:write:all",
    "agenda:write:own",
    "clients:read",
    "clients:write",
    "commissions:read:all",
    "commissions:read:own",
  ],
  MANAGER: [
    "finance:read",
    "finance:write",
    "services:manage",
    "professionals:manage",
    "agenda:read:all",
    "agenda:read:own",
    "agenda:write:all",
    "agenda:write:own",
    "clients:read",
    "clients:write",
    "commissions:read:all",
    "commissions:read:own",
  ],
  BARBER: [
    "agenda:read:own",
    "agenda:write:own",
    "clients:read",
    "clients:write",
    "commissions:read:own",
  ],
  RECEPTION: [
    "agenda:read:all",
    "agenda:read:own",
    "agenda:write:all",
    "agenda:write:own",
    "clients:read",
    "clients:write",
  ],
};

/** Unico ponto de checagem de permissao do sistema. */
export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}
