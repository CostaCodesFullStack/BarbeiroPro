"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await api("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
        router.push("/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
