"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage, formatBRL } from "@/lib/client-api";

type Sub = {
  status: "PENDING_PAYMENT" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELING" | "CANCELED" | null;
  cancelState: "PENDING" | "SCHEDULED" | "ENDED" | null;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  accessEndsAt: string | null;
  cancellationConfirmed: boolean;
  hasGateway: boolean;
  priceCents: number;
  trialDays: number;
};

const LABEL: Record<NonNullable<Sub["status"]>, string> = {
  PENDING_PAYMENT: "Aguardando cartão",
  TRIALING: "Teste grátis",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento em atraso",
  CANCELING: "Renovação cancelada",
  CANCELED: "Cancelada",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function AssinaturaClient() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshSubscription() {
    setSub(await api<Sub>("/api/v1/subscription"));
  }

  useEffect(() => {
    refreshSubscription().catch((e) => setError(errorMessage(e)));
  }, []);

  function confirmationMessage() {
    if (!sub) return "Cancelar a assinatura?";
    if (sub.status === "TRIALING") {
      return "Cancelar o teste? Após a confirmação do Asaas, o painel de escrita e os novos agendamentos serão encerrados. Seus dados serão preservados.";
    }
    if (sub.status === "PAST_DUE") {
      return `Cancelar a renovação? O acesso continuará durante a tolerância de pagamento vigente${sub.accessEndsAt ? `, até ${day(sub.accessEndsAt)}` : ""}. A cobrança pendente será removida pelo Asaas.`;
    }
    const date = sub.currentPeriodEnd ? day(sub.currentPeriodEnd) : "o fim do período pago";
    return `Cancelar a renovação? Você continuará usando o BarbeiroPro até ${date}. O cancelamento não aciona reembolso proporcional automático; direitos previstos em lei permanecem aplicáveis.`;
  }

  async function cancel() {
    if (sub?.cancelState !== "PENDING" && !window.confirm(confirmationMessage())) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/subscription/cancel", { method: "POST" });
      router.refresh();
      await refreshSubscription();
    } catch (e) {
      setError(errorMessage(e));
      // Mostra um eventual estado pendente sem afirmar que houve cancelamento.
      await refreshSubscription().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (error && !sub) return <div className="card"><div className="error" role="alert">{error}</div></div>;
  if (!sub) return <p className="muted">Carregando...</p>;

  const canCancel = ["TRIALING", "ACTIVE", "PAST_DUE"].includes(sub.status ?? "") &&
    sub.cancelState !== "SCHEDULED" && sub.cancelState !== "ENDED";

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
      {sub.status === "TRIALING" && (
        <>
          <div className="line">
            <span>Teste grátis até</span>
            <strong>{day(sub.trialEndsAt)}</strong>
          </div>
          {sub.currentPeriodEnd && (
            <div className="line">
              <span>Primeira cobrança prevista</span>
              <strong>{day(sub.currentPeriodEnd)}</strong>
            </div>
          )}
          <p className="muted">A primeira cobrança ocorre depois de pelo menos sete dias completos do envio dos dados do cartão. Como o Asaas agenda por data, o intervalo pode chegar a oito dias.</p>
        </>
      )}
      {sub.status === "ACTIVE" && sub.currentPeriodEnd && (
        <div className="line">
          <span>Pago até</span>
          <strong>{day(sub.currentPeriodEnd)}</strong>
        </div>
      )}
      {sub.status === "PAST_DUE" && (
        <p className="error">
          Não conseguimos cobrar seu cartão. A tolerância de cinco dias após o vencimento continua valendo.
        </p>
      )}
      {sub.cancelState === "PENDING" && (
        <p className="error" role="alert">
          O Asaas ainda não confirmou o cancelamento. A solicitação não está concluída; tente novamente para confirmar.
        </p>
      )}
      {sub.cancelState === "SCHEDULED" && sub.accessEndsAt && (
        <p className="muted">
          A renovação foi cancelada. O acesso ao painel e aos agendamentos continua até {day(sub.accessEndsAt)}. Não há reembolso proporcional automático; direitos previstos em lei permanecem aplicáveis.
        </p>
      )}
      {sub.status === "CANCELED" && (
        <p className="muted">Assinatura cancelada. Seus dados estão preservados. Para voltar, fale com o suporte.</p>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      {canCancel && (
        <button style={{ marginTop: 14 }} onClick={cancel} disabled={busy}>
          {busy ? "Cancelando..." : sub.cancelState === "PENDING" ? "Tentar novamente" : "Cancelar assinatura"}
        </button>
      )}
    </div>
  );
}
