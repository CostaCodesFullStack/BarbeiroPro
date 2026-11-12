"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      className="dashboard-logout"
      onClick={async () => {
        await api("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
        router.push("/login");
        router.refresh();
      }}
    >
      Sair
    </Button>
  );
}
