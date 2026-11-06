"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage, formatBRL } from "@/lib/client-api";

const PRICE_CENTS = 7990; // espelha PLAN_MONTHLY_CENTS (src/lib/billing/plan.ts)

const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const fmtExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
const fmtCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export default function CheckoutClient({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [holderName, setHolderName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [name, setName] = useState(defaultName);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const [mm, yy] = expiry.split("/");
    if (!mm || !yy || yy.length !== 2) {
      setError("Informe a validade no formato MM/AA");
      return;
    }

    setSaving(true);
    try {
      await api("/api/v1/subscription/checkout", {
        method: "POST",
        body: {
          card: { holderName, number, expiryMonth: mm, expiryYear: `20${yy}`, ccv },
          holder: { name, cpfCnpj, postalCode, addressNumber, phone },
        },
      });
      router.refresh(); // o painel recarrega já liberado
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} autoComplete="on">
      <h2>Ative sua conta</h2>
      <p>
        <strong>7 dias grátis.</strong> Seu cartão é validado agora, mas a primeira cobrança de{" "}
        <strong>{formatBRL(PRICE_CENTS)}</strong> só acontece no 8º dia, e depois todo mês. Cancele quando quiser.
      </p>
      <p className="muted">Com a conta ativa você libera o cadastro de serviços e profissionais.</p>

      <h3 style={{ marginTop: 20 }}>Cartão de crédito</h3>
      <label htmlFor="cc-number">Número do cartão</label>
      <input id="cc-number" required inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={number} onChange={(e) => setNumber(fmtCard(e.target.value))} />
      <label htmlFor="cc-name">Nome impresso no cartão</label>
      <input id="cc-name" required autoComplete="cc-name" value={holderName} onChange={(e) => setHolderName(e.target.value.toUpperCase())} />
      <div className="row">
        <div>
          <label htmlFor="cc-exp">Validade (MM/AA)</label>
          <input id="cc-exp" required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={expiry} onChange={(e) => setExpiry(fmtExpiry(e.target.value))} />
        </div>
        <div>
          <label htmlFor="cc-csc">Código de segurança</label>
          <input id="cc-csc" required inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={ccv} onChange={(e) => setCcv(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>

      <h3 style={{ marginTop: 20 }}>Titular do cartão</h3>
      <label htmlFor="h-name">Nome completo</label>
      <input id="h-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="h-doc">CPF ou CNPJ</label>
      <input id="h-doc" required inputMode="numeric" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
      <div className="row">
        <div>
          <label htmlFor="h-cep">CEP</label>
          <input id="h-cep" required inputMode="numeric" autoComplete="postal-code" value={postalCode} onChange={(e) => setPostalCode(fmtCep(e.target.value))} />
        </div>
        <div>
          <label htmlFor="h-num">Número</label>
          <input id="h-num" required maxLength={10} value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
        </div>
      </div>
      <label htmlFor="h-phone">Telefone com DDD</label>
      <input id="h-phone" required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />

      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={saving}>
        {saving ? "Validando cartão..." : "Começar meus 7 dias grátis"}
      </button>
      <p className="legal">
        Pagamento processado pelo Asaas. O BarbeiroPro não guarda os dados do seu cartão.
      </p>
    </form>
  );
}
