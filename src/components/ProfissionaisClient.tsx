"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";

type Professional = { id: string; name: string; commissionBps: number; active: boolean };

export default function ProfissionaisClient() {
  const [list, setList] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("30");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      setList(await api<Professional[]>("/api/v1/professionals?includeInactive=true"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const pct = Number(commission.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setFormError("A comissão deve ser entre 0 e 100%");
      return;
    }
    try {
      await api("/api/v1/professionals", {
        method: "POST",
        body: { name, commissionBps: Math.round(pct * 100) },
      });
      setName("");
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <>
      <form className="card" onSubmit={create}>
        <h3>Novo profissional</h3>
        <div className="row">
          <div>
            <label htmlFor="pname">Nome</label>
            <input id="pname" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pcomm">Comissão (%)</label>
            <input id="pcomm" required inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </div>
        </div>
        {formError && <div className="error" role="alert">{formError}</div>}
        <button className="primary" type="submit">Adicionar profissional</button>
      </form>

      <div className="card">
        <h3>Sua equipe</h3>
        {error && <div className="error" role="alert">{error}</div>}
        {loading ? (
          <p className="muted">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="muted">Nenhum profissional cadastrado ainda.</p>
        ) : (
          list.map((p) => (
            <div className={`line${p.active ? "" : " inactive"}`} key={p.id}>
              <div className="grow">
                <strong>{p.name}</strong> {!p.active && <span className="badge">Inativo</span>}
                <div className="muted">Comissão: {(p.commissionBps / 100).toLocaleString("pt-BR")}%</div>
              </div>
              <Link href={`/painel/profissionais/${p.id}`}>Configurar →</Link>
            </div>
          ))
        )}
      </div>
    </>
  );
}
