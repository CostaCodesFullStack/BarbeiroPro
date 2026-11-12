import type { ReactNode } from "react";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

export default function PublicShell({
  children,
  mode = "standard",
}: {
  children: ReactNode;
  /** O booking usa somente o tema e o container, sem navegação que distraia do agendamento. */
  mode?: "standard" | "booking";
}) {
  if (mode === "booking") {
    return <div className="public-theme public-theme--booking">{children}</div>;
  }

  return (
    <div className="public-theme">
      <div className="public-shell">
        <PublicHeader />
        <div className="public-shell__content">{children}</div>
        <PublicFooter />
      </div>
    </div>
  );
}
