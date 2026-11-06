"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage, formatBRL } from "@/lib/client-api";

type Sub = {
  status: "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | null;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  hasGateway: boolean;
  priceCents: number;
  trialDays: number;
};

const LABEL: Record<NonNullable<Sub["status"]>, string> = {
  PENDING_PAYMENT: "Aguardando cartão",
  TRIALING: "Teste grátis",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento em atraso",
  CANCELED: "Cancelada",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function AssinaturaClient() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setSub(await api<Sub>("/api/v1/subscription"));
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, []);

  async function cancel() {
    if (!window.confirm("Cancelar a assinatura? Seus dados serão mantidos, mas o painel ficará somente para consulta.")) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/subscription/cancel", { method: "POST" });
      router.refresh();
      setSub(await api<Sub>("/api/v1/subscription"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error && !sub) return <div className="card"><div className="error" role="alert">{error}</div></div>;
  if (!sub) return <p className="muted">Carregando...</p>;

  return (
    <div className="card">
      <h3>Sua assinatura</h3>
      <div className="line">
        <span>Situação</span>
        <strong>{sub.status ? LABEL[sub.status] : "—"}</strong>
      </div>
      <div className="line">
        <span>Plano</span>
        <strong>BarbeiroPro · {formatBRL(sub.priceCents)}/mês</strong>
      </div>
      {sub.status === "TRIALING" && sub.currentPeriodEnd && (
        <div className="line">
          <span>Primeira cobrança</span>
          <strong>{day(sub.currentPeriodEnd)}</strong>
        </div>
      )}
      {sub.status === "ACTIVE" && sub.currentPeriodEnd && (
        <div className="line">
          <span>Pago até</span>
          <strong>{day(sub.currentPeriodEnd)}</strong>
        </div>
      )}
      {sub.status === "PAST_DUE" && (
        <p className="error">
          Não conseguimos cobrar seu cartão. Você tem alguns dias de tolerância antes de o painel ficar somente para consulta.
        </p>
      )}
      {sub.status === "CANCELED" && (
        <p className="muted">Assinatura cancelada. Seus dados estão preservados. Para voltar, fale com o suporte.</p>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      {(sub.status === "TRIALING" || sub.status === "ACTIVE" || sub.status === "PAST_DUE") && (
        <button style={{ marginTop: 14 }} onClick={cancel} disabled={busy}>
          {busy ? "Cancelando..." : "Cancelar assinatura"}
        </button>
      )}
    </div>
  );
}
