import type { Metadata } from "next";
import ForBarbersLanding from "@/components/public/ForBarbersLanding";

export const metadata: Metadata = {
  title: "Para barbearias | BarbeiroPro",
  description:
    "Organize a agenda da sua barbearia e ofereça agendamento online com o BarbeiroPro.",
};

export default function ForBarbersPage() {
  return <ForBarbersLanding />;
}
