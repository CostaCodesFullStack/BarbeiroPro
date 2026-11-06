"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PainelNav({
  canConfigure,
  canSubscribe,
}: {
  canConfigure: boolean;
  canSubscribe: boolean;
}) {
  const pathname = usePathname();
  const items = [
    { href: "/painel", label: "Agenda", show: true, exact: true },
    { href: "/painel/servicos", label: "Serviços", show: canConfigure, exact: false },
    { href: "/painel/profissionais", label: "Profissionais", show: canConfigure, exact: false },
    { href: "/painel/assinatura", label: "Assinatura", show: canSubscribe, exact: false },
  ];
  return (
    <nav className="nav">
      {items
        .filter((i) => i.show)
        .map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} className={active ? "active" : undefined}>
              {i.label}
            </Link>
          );
        })}
    </nav>
  );
}
