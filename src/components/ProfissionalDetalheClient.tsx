"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { zonedToUtc } from "@/lib/availability/tz";
import {
  api,
  centsToInput,
  errorMessage,
  formatBRL,
  formatDateTime,
  parseBRLToCents,
} from "@/lib/client-api";

type Professional = { id: string; name: string; commissionBps: number; active: boolean };
type Service = { id: string; name: string; durationMin: number; priceCents: number; active: boolean };
type ServiceLink = { serviceId: string; customPriceCents: number | null };
type Hour = { weekday: number; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null };
type Block = { id: string; startAt: string; endAt: string; reason: string | null };
type Msg = { kind: "ok" | "err"; text: string } | null;
type Day = { enabled: boolean; startTime: string; endTime: string; breakStart: string; breakEnd: string };
type Pick = { checked: boolean; price: string };

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const emptyDay = (): Day => ({ enabled: false, startTime: "09:00", endTime: "18:00", breakStart: "", breakEnd: "" });

function MsgView({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <div className={msg.kind === "ok" ? "success" : "error"} role={msg.kind === "err" ? "alert" : undefined}>{msg.text}</div>;
}

export default function ProfissionalDetalheClient({ id }: { id: string }) {
  const [pro, setPro] = useState<Professional | null>(null);
  const [loadError, setLoadError] = useState("");

  // dados
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("");
  const [active, setActive] = useState(true);
  const [dataMsg, setDataMsg] = useState<Msg>(null);

  // serviços
  const [services, setServices] = useState<Service[]>([]);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [svcMsg, setSvcMsg] = useState<Msg>(null);

  // horários
  const [days, setDays] = useState<Day[]>(Array.from({ length: 7 }, emptyDay));
  const [hoursMsg, setHoursMsg] = useState<Msg>(null);

  // bloqueios
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [bStart, setBStart] = useState("");
  const [bEnd, setBEnd] = useState("");
  const [bReason, setBReason] = useState("");
  const [blockMsg, setBlockMsg] = useState<Msg>(null);

  const loadBlocks = useCallback(async () => {
    setBlocks(await api<Block[]>(`/api/v1/professionals/${id}/time-blocks`));
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const [p, allServices, links, hours] = await Promise.all([
          api<Professional>(`/api/v1/professionals/${id}`),
          api<Service[]>("/api/v1/services"),
          api<ServiceLink[]>(`/api/v1/professionals/${id}/services`),
          api<Hour[]>(`/api/v1/professionals/${id}/working-hours`),
        ]);
        setPro(p);
        setName(p.name);
        setCommission(String(p.commissionBps / 100).replace(".", ","));
        setActive(p.active);

        setServices(allServices);
        const map: Record<string, Pick> = {};
        for (const s of allServices) {
          const link = links.find((l) => l.serviceId === s.id);
          map[s.id] = {
            checked: Boolean(link),
            price: link?.customPriceCents != null ? centsToInput(link.customPriceCents) : "",
          };
        }
        setPicks(map);

        const next = Array.from({ length: 7 }, emptyDay);
        for (const h of hours) {
          next[h.weekday] = {
            enabled: true,
            startTime: h.startTime,
            endTime: h.endTime,
            breakStart: h.breakStart ?? "",
            breakEnd: h.breakEnd ?? "",
          };
        }
        setDays(next);
        await loadBlocks();
      } catch (e) {
        setLoadError(errorMessage(e));
      }
    })();
  }, [id, loadBlocks]);

  async function saveData() {
    setDataMsg(null);
    const pct = Number(commission.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setDataMsg({ kind: "err", text: "A comissão deve ser entre 0 e 100%" });
      return;
    }
    try {
      const p = await api<Professional>(`/api/v1/professionals/${id}`, {
        method: "PATCH",
        body: { name, commissionBps: Math.round(pct * 100), active },
      });
      setPro(p);
      setDataMsg({ kind: "ok", text: "Dados salvos." });
    } catch (e) {
      setDataMsg({ kind: "err", text: errorMessage(e) });
    }
  }

  async function saveServices() {
    setSvcMsg(null);
    try {
      const chosen = services
        .filter((s) => picks[s.id]?.checked)
        .map((s) => {
          const raw = picks[s.id].price.trim();
          if (!raw) return { serviceId: s.id, customPriceCents: null };
          const cents = parseBRLToCents(raw);
          if (cents === null) throw new Error(`Preço inválido em "${s.name}"`);
          return { serviceId: s.id, customPriceCents: cents };
        });
      await api(`/api/v1/professionals/${id}/services`, { method: "PUT", body: { services: chosen } });
      setSvcMsg({ kind: "ok", text: "Serviços salvos." });
    } catch (e) {
      setSvcMsg({ kind: "err", text: errorMessage(e) });
    }
  }

  async function saveHours() {
    setHoursMsg(null);
    try {
      const payload = ORDER.filter((w) => days[w].enabled).map((w) => {
        const d = days[w];
        if (Boolean(d.breakStart) !== Boolean(d.breakEnd)) {
          throw new Error(`${DAY_NAMES[w]}: informe início e fim do intervalo, ou deixe os dois vazios`);
        }
        return {
          weekday: w,
          startTime: d.startTime,
          endTime: d.endTime,
          ...(d.breakStart && d.breakEnd ? { breakStart: d.breakStart, breakEnd: d.breakEnd } : {}),
        };
      });
      await api(`/api/v1/professionals/${id}/working-hours`, { method: "PUT", body: { days: payload } });
      setHoursMsg({ kind: "ok", text: "Horários salvos." });
    } catch (e) {
      setHoursMsg({ kind: "err", text: errorMessage(e) });
    }
  }

  function setDay(w: number, patch: Partial<Day>) {
    setDays((prev) => prev.map((d, i) => (i === w ? { ...d, ...patch } : d)));
  }

  /** "2026-11-02T10:00" (campo datetime-local, horário de São Paulo) -> ISO UTC */
  function localToIso(value: string): string {
    const [d, t] = value.split("T");
    return zonedToUtc(d, t).toISOString();
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    setBlockMsg(null);
    try {
      await api(`/api/v1/professionals/${id}/time-blocks`, {
        method: "POST",
        body: { startAt: localToIso(bStart), endAt: localToIso(bEnd), reason: bReason || undefined },
      });
      setBStart("");
      setBEnd("");
      setBReason("");
      await loadBlocks();
      setBlockMsg({ kind: "ok", text: "Bloqueio criado." });
    } catch (err) {
      setBlockMsg({ kind: "err", text: errorMessage(err) });
    }
  }

  async function removeBlock(blockId: string) {
    try {
      await api(`/api/v1/time-blocks/${blockId}`, { method: "DELETE" });
      await loadBlocks();
    } catch (err) {
      setBlockMsg({ kind: "err", text: errorMessage(err) });
    }
  }

  if (loadError) {
    return (
      <div className="card">
        <div className="error" role="alert">{loadError}</div>
        <p><Link href="/painel/profissionais">← Voltar</Link></p>
      </div>
    );
  }
  if (!pro) return <p className="muted">Carregando...</p>;

  return (
    <>
      <p><Link href="/painel/profissionais">← Profissionais</Link></p>

      <div className="card">
        <h3>Dados</h3>
        <div className="row">
          <div>
            <label htmlFor="dname">Nome</label>
            <input id="dname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dcomm">Comissão (%)</label>
            <input id="dcomm" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </div>
        </div>
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativo (aparece na agenda)
        </label>
        <MsgView msg={dataMsg} />
        <button className="save" onClick={saveData}>Salvar dados</button>
      </div>

      <div className="card">
        <h3>Serviços que realiza</h3>
        {services.length === 0 ? (
          <p className="muted">Cadastre serviços primeiro na aba Serviços.</p>
        ) : (
          services.map((s) => (
            <div className={`line${s.active ? "" : " inactive"}`} key={s.id}>
              <label className="check grow">
                <input
                  type="checkbox"
                  checked={picks[s.id]?.checked ?? false}
                  onChange={(e) => setPicks((p) => ({ ...p, [s.id]: { ...p[s.id], checked: e.target.checked } }))}
                />
                <span>{s.name} <span className="muted">({s.durationMin} min · {formatBRL(s.priceCents)})</span></span>
              </label>
              <input
                aria-label={`Preço específico para ${s.name}`}
                style={{ width: 150 }}
                inputMode="decimal"
                placeholder="Preço próprio"
                disabled={!picks[s.id]?.checked}
                value={picks[s.id]?.price ?? ""}
                onChange={(e) => setPicks((p) => ({ ...p, [s.id]: { ...p[s.id], price: e.target.value } }))}
              />
            </div>
          ))
        )}
        <div className="muted" style={{ marginTop: 8 }}>Deixe o preço próprio em branco para usar o preço do serviço.</div>
        <MsgView msg={svcMsg} />
        <button className="save" onClick={saveServices} disabled={services.length === 0}>Salvar serviços</button>
      </div>

      <div className="card">
        <h3>Horário de trabalho</h3>
        <div className="days">
          {ORDER.map((w) => {
            const d = days[w];
            return (
              <div className="day" key={w}>
                <label className="check">
                  <input type="checkbox" checked={d.enabled} onChange={(e) => setDay(w, { enabled: e.target.checked })} />
                  {DAY_NAMES[w]}
                </label>
                {d.enabled ? (
                  <div className="times">
                    <input type="time" aria-label={`${DAY_NAMES[w]} início`} value={d.startTime} onChange={(e) => setDay(w, { startTime: e.target.value })} />
                    <span>às</span>
                    <input type="time" aria-label={`${DAY_NAMES[w]} fim`} value={d.endTime} onChange={(e) => setDay(w, { endTime: e.target.value })} />
                    <span className="muted">Pausa:</span>
                    <input type="time" aria-label={`${DAY_NAMES[w]} início da pausa`} value={d.breakStart} onChange={(e) => setDay(w, { breakStart: e.target.value })} />
                    <span>às</span>
                    <input type="time" aria-label={`${DAY_NAMES[w]} fim da pausa`} value={d.breakEnd} onChange={(e) => setDay(w, { breakEnd: e.target.value })} />
                  </div>
                ) : (
                  <span className="muted">Não trabalha</span>
                )}
              </div>
            );
          })}
        </div>
        <MsgView msg={hoursMsg} />
        <button className="save" onClick={saveHours}>Salvar horários</button>
      </div>

      <div className="card">
        <h3>Bloqueios (folgas, compromissos)</h3>
        {blocks.length === 0 ? (
          <p className="muted">Nenhum bloqueio futuro.</p>
        ) : (
          blocks.map((b) => (
            <div className="line" key={b.id}>
              <div className="grow">
                {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
                {b.reason && <div className="muted">{b.reason}</div>}
              </div>
              <button className="small" onClick={() => removeBlock(b.id)}>Remover</button>
            </div>
          ))
        )}
        <form onSubmit={addBlock}>
          <div className="row">
            <div>
              <label htmlFor="bstart">Início</label>
              <input id="bstart" type="datetime-local" required value={bStart} onChange={(e) => setBStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bend">Fim</label>
              <input id="bend" type="datetime-local" required value={bEnd} onChange={(e) => setBEnd(e.target.value)} />
            </div>
            <div>
              <label htmlFor="breason">Motivo (opcional)</label>
              <input id="breason" maxLength={200} value={bReason} onChange={(e) => setBReason(e.target.value)} />
            </div>
          </div>
          <MsgView msg={blockMsg} />
          <button className="save" type="submit">Adicionar bloqueio</button>
        </form>
      </div>
    </>
  );
}
