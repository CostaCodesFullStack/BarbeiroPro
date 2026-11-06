export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

const NEXT: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELED", "NO_SHOW"],
  COMPLETED: [],
  CANCELED: [],
  NO_SHOW: [],
};

/** Estados finais (concluido, cancelado, faltou) nao mudam mais. */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return NEXT[from].includes(to);
}
