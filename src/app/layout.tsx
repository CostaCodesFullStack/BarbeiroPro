import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "BarbeiroPro",
  description: "Gestão e agendamento online para barbearias",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
