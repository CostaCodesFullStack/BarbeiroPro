"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays } from "@/lib/availability/tz";
import { api, errorMessage, formatBRL, formatTime, todayInSaoPaulo } from "@/lib/client-api";

type Status = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
type Professional = { id: string; name: string };
type Service = { id: string; name: string; durationMin: number; priceCents: number };
type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: Status;
  priceCents: number;
  client: { id: string; name: string; phone: string };
  service: { id: string; name: string; durationMin: number };
  professional: { id: string; name: string };
};
type Availability = { slots: string[] };

const STATUS_LABEL: Record<Status, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluido",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

const ACTIONS: Record<Status, { to: Exclude<Status, "SCHEDULED">; label: string }[]> = {
  SCHEDULED: [
    { to: "CONFIRMED", label: "Confirmar" },
    { to: "COMPLETED", label: "Concluir" },
    { to: "NO_SHOW", label: "Faltou" },
    { to: "CANCELED", label: "Cancelar" },
  ],
  CONFIRMED: [
    { to: "COMPLETED", label: "Concluir" },
    { to: "NO_SHOW", label: "Faltou" },
    { to: "CANCELED", label: "Cancelar" },
  ],
  COMPLETED: [],
  CANCELED: [],
  NO_SHOW: [],
};

export default function AgendaClient() {
  const [date, setDate] = useState(todayInSaoPaulo());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");

  // formulario de novo agendamento
  const [proId, setProId] = useState("");
  const [allowedServiceIds, setAllowedServiceIds] = useState<string[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  const loadAppointments = useCallback(async () => {
    setLoadingList(true);
    try {
      setAppointments(await api<Appointment[]>(`/api/v1/appointments?date=${date}`));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingList(false);
    }
  }, [date]);

  const loadSlots = useCallback(async () => {
    if (!proId || !serviceId) {
      setSlots([]);
      return;
    }
    try {
      const r = await api<Availability>(
        `/api/v1/availability?professionalId=${proId}&serviceId=${serviceId}&date=${date}`,
      );
      setSlots(r.slots);
      setSlot("");
      setFormError("");
    } catch (e) {
      setSlots([]);
      setFormError(errorMessage(e));
    }
  }, [proId, serviceId, date]);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api<Professional[]>("/api/v1/professionals"),
          api<Service[]>("/api/v1/services"),
        ]);
        setProfessionals(p);
        setServices(s);
        if (p[0]) setProId(p[0].id);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (!proId) return;
    (async () => {
      try {
        const links = await api<{ serviceId: string }[]>(`/api/v1/professionals/${proId}/services`);
        const ids = links.map((l) => l.serviceId);
        setAllowedServiceIds(ids);
        setServiceId(ids[0] ?? "");
      } catch (e) {
        setFormError(errorMessage(e));
      }
    })();
  }, [proId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    setSaving(true);
    try {
      await api("/api/v1/appointments", {
        method: "POST",
        body: {
          professionalId: proId,
          serviceId,
          startAt: slot,
          client: { name: clientName, phone: clientPhone },
        },
      });
      setFormOk("Agendamento criado.");
      setClientName("");
      setClientPhone("");
      await Promise.all([loadAppointments(), loadSlots()]);
    } catch (err) {
      setFormError(errorMessage(err));
      await loadSlots(); // o horario pode ter sido ocupado por outra pessoa
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: Status) {
    try {
      await api(`/api/v1/appointments/${id}/status`, { method: "PATCH", body: { status } });
      await Promise.all([loadAppointments(), loadSlots()]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const offeredServices = services.filter((s) => allowedServiceIds.includes(s.id));
  const needsSetup = professionals.length === 0 || services.length === 0;

  return (
    <>
      <div className="card">
        <div className="header">
          <h3 style={{ margin: 0 }}>Agenda do dia</h3>
          <div className="datebar">
            <button onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">←</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button onClick={() => setDate(addDays(date, 1))} aria-label="Proximo dia">→</button>
            <button onClick={() => setDate(todayInSaoPaulo())}>Hoje</button>
          </div>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        {loadingList ? (
          <p className="muted">Carregando...</p>
        ) : appointments.length === 0 ? (
          <p className="muted">Nenhum agendamento neste dia.</p>
        ) : (
          appointments.map((a) => (
            <div className="appt" key={a.id}>
              <div className="time">{formatTime(a.startAt)}</div>
              <div className="info">
                <div>
                  <strong>{a.client.name}</strong> <span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <div className="muted">
                  {a.service.name} · {a.professional.name} · {formatBRL(a.priceCents)} · {a.client.phone}
                </div>
              </div>
              <div className="actions">
                {ACTIONS[a.status].map((act) => (
                  <button key={act.to} onClick={() => changeStatus(a.id, act.to)}>{act.label}</button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="card" onSubmit={createAppointment}>
        <h3>Novo agendamento</h3>
        {needsSetup ? (
          <p className="muted">
            Antes de agendar, cadastre ao menos um serviço (aba Serviços) e um profissional (aba Profissionais).
            Na tela do profissional, escolha os serviços que ele realiza e defina os horários de trabalho.
          </p>
        ) : (
          <>
            <div className="row">
              <div>
                <label htmlFor="pro">Profissional</label>
                <select id="pro" value={proId} onChange={(e) => setProId(e.target.value)}>
                  {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="svc">Servico</label>
                <select id="svc" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={offeredServices.length === 0}>
                  {offeredServices.length === 0 && <option value="">Sem servicos vinculados</option>}
                  {offeredServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min · {formatBRL(s.priceCents)})</option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="slot">Horario livre em {date.split("-").reverse().join("/")}</label>
            <select id="slot" required value={slot} onChange={(e) => setSlot(e.target.value)} disabled={slots.length === 0}>
              <option value="">{slots.length === 0 ? "Sem horarios livres" : "Escolha um horario"}</option>
              {slots.map((s) => <option key={s} value={s}>{formatTime(s)}</option>)}
            </select>
            <div className="row">
              <div>
                <label htmlFor="cname">Nome do cliente</label>
                <input id="cname" required minLength={2} value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="cphone">Telefone</label>
                <input id="cphone" required inputMode="tel" placeholder="(11) 99999-0000" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
            </div>
            {formError && <div className="error" role="alert">{formError}</div>}
            {formOk && <div className="success">{formOk}</div>}
            <button className="primary" type="submit" disabled={saving || !slot}>
              {saving ? "Salvando..." : "Agendar"}
            </button>
          </>
        )}
      </form>
    </>
  );
}
