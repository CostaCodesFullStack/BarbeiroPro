"use client";

import { useCallback, useEffect, useState } from "react";
import { api, centsToInput, errorMessage, formatBRL, parseBRLToCents } from "@/lib/client-api";

type Service = { id: string; name: string; durationMin: number; priceCents: number; active: boolean };

export default function ServicosClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eDuration, setEDuration] = useState("");
  const [ePrice, setEPrice] = useState("");

  const load = useCallback(async () => {
    try {
      setServices(await api<Service[]>("/api/v1/services?includeInactive=true"));
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

  function toPayload(n: string, d: string, p: string) {
    const cents = parseBRLToCents(p);
    if (cents === null) throw new Error("Informe um preço válido, ex.: 50,00");
    const durationMin = Number(d);
    if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 480) {
      throw new Error("A duração deve ser entre 5 e 480 minutos");
    }
    return { name: n, durationMin, priceCents: cents };
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      await api("/api/v1/services", { method: "POST", body: toPayload(name, duration, price) });
      setName("");
      setPrice("");
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setEName(s.name);
    setEDuration(String(s.durationMin));
    setEPrice(centsToInput(s.priceCents));
    setError("");
  }

  async function saveEdit(id: string) {
    try {
      await api(`/api/v1/services/${id}`, { method: "PATCH", body: toPayload(eName, eDuration, ePrice) });
      setEditId(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function toggle(s: Service) {
    try {
      await api(`/api/v1/services/${s.id}`, { method: "PATCH", body: { active: !s.active } });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <form className="card" onSubmit={create}>
        <h3>Novo serviço</h3>
        <div className="row">
          <div>
            <label htmlFor="sname">Nome</label>
            <input id="sname" required minLength={2} placeholder="Corte, Barba..." value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sdur">Duração (min)</label>
            <input id="sdur" type="number" required min={5} max={480} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sprice">Preço (R$)</label>
            <input id="sprice" required inputMode="decimal" placeholder="50,00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        {formError && <div className="error" role="alert">{formError}</div>}
        <button className="primary" type="submit">Adicionar serviço</button>
      </form>

      <div className="card">
        <h3>Seus serviços</h3>
        {error && <div className="error" role="alert">{error}</div>}
        {loading ? (
          <p className="muted">Carregando...</p>
        ) : services.length === 0 ? (
          <p className="muted">Nenhum serviço cadastrado ainda.</p>
        ) : (
          services.map((s) =>
            editId === s.id ? (
              <div className="line" key={s.id}>
                <div className="row grow">
                  <input aria-label="Nome" value={eName} onChange={(e) => setEName(e.target.value)} />
                  <input aria-label="Duração" type="number" min={5} max={480} step={5} value={eDuration} onChange={(e) => setEDuration(e.target.value)} />
                  <input aria-label="Preço" inputMode="decimal" value={ePrice} onChange={(e) => setEPrice(e.target.value)} />
                </div>
                <div className="actions">
                  <button className="small" onClick={() => saveEdit(s.id)}>Salvar</button>
                  <button className="small" onClick={() => setEditId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className={`line${s.active ? "" : " inactive"}`} key={s.id}>
                <div className="grow">
                  <strong>{s.name}</strong> {!s.active && <span className="badge">Inativo</span>}
                  <div className="muted">{s.durationMin} min · {formatBRL(s.priceCents)}</div>
                </div>
                <div className="actions">
                  <button className="small" onClick={() => startEdit(s)}>Editar</button>
                  <button className="small" onClick={() => toggle(s)}>{s.active ? "Desativar" : "Reativar"}</button>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </>
  );
}
