"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays } from "@/lib/availability/tz";
import { api, errorMessage, formatBRL, formatTime, todayInSaoPaulo } from "@/lib/client-api";

type Service = { id: string; name: string; durationMin: number; priceCents: number };
type ProLink = { serviceId: string; customPriceCents: number | null };
type Professional = { id: string; name: string; services: ProLink[] };
type TenantInfo = { name: string; phone: string | null; address: string | null };
type PublicData = { tenant: TenantInfo; services: Service[]; professionals: Professional[] };
type Confirmation = {
  appointment: {
    id: string;
    startAt: string;
    priceCents: number;
    service: { name: string };
    professional: { name: string };
  };
  tenant: TenantInfo;
};

function effectivePrice(service: Service, professional: Professional): number {
  return professional.services.find((link) => link.serviceId === service.id)?.customPriceCents ?? service.priceCents;
}

function servicePriceRange(service: Service, professionals: Professional[]) {
  const prices = professionals
    .filter((professional) => professional.services.some((link) => link.serviceId === service.id))
    .map((professional) => effectivePrice(service, professional));

  if (prices.length === 0) return { minPriceCents: service.priceCents, maxPriceCents: service.priceCents };

  return prices.reduce(
    (range, price) => ({
      minPriceCents: Math.min(range.minPriceCents, price),
      maxPriceCents: Math.max(range.maxPriceCents, price),
    }),
    { minPriceCents: prices[0], maxPriceCents: prices[0] },
  );
}

function servicePriceDisplay(service: Service, professionals: Professional[], selectedProfessional?: Professional) {
  const { minPriceCents, maxPriceCents } = servicePriceRange(service, professionals);
  const selectedPriceCents = selectedProfessional ? effectivePrice(service, selectedProfessional) : null;

  return {
    minPriceCents,
    maxPriceCents,
    shownPriceCents: selectedPriceCents ?? minPriceCents,
    hasPriceRange: selectedPriceCents === null && minPriceCents !== maxPriceCents,
  };
}

function chip(date: string) {
  const dt = new Date(`${date}T12:00:00Z`);
  const wd = dt.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const [, m, d] = date.split("-");
  return { wd, label: `${d}/${m}` };
}

export default function BookingClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [loadError, setLoadError] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [proId, setProId] = useState("");
  const dates = useMemo(() => {
    const today = todayInSaoPaulo();
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);
  const [date, setDate] = useState(dates[0]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Confirmation | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api<PublicData>(`/api/v1/public/${slug}`));
      } catch (e) {
        setLoadError(errorMessage(e));
      }
    })();
  }, [slug]);

  const proOptions = useMemo(
    () => (data ? data.professionals.filter((p) => p.services.some((l) => l.serviceId === serviceId)) : []),
    [data, serviceId],
  );

  function pickService(id: string) {
    setServiceId(id);
    setSlot("");
    setError("");
    const options = data?.professionals.filter((p) => p.services.some((l) => l.serviceId === id)) ?? [];
    setProId(options.length === 1 ? options[0].id : "");
  }

  const loadSlots = useCallback(async () => {
    if (!proId || !serviceId) return;
    setSlots(null);
    try {
      const r = await api<{ slots: string[] }>(
        `/api/v1/public/${slug}/availability?professionalId=${proId}&serviceId=${serviceId}&date=${date}`,
      );
      setSlots(r.slots);
      setSlot("");
    } catch (e) {
      setSlots([]);
      setError(errorMessage(e));
    }
  }, [slug, proId, serviceId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await api<Confirmation>(`/api/v1/public/${slug}/appointments`, {
        method: "POST",
        body: { professionalId: proId, serviceId, startAt: slot, client: { name, phone } },
      });
      setDone(result);
    } catch (err) {
      setError(errorMessage(err));
      await loadSlots(); // o horário pode ter sido ocupado por outra pessoa
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDone(null);
    setServiceId("");
    setProId("");
    setSlot("");
    setSlots(null);
    setName("");
    setPhone("");
    setError("");
  }

  if (loadError) {
    return (
      <main className="book">
        <div className="card">
          <div className="error" role="alert">{loadError}</div>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="book">
        <p className="muted">Carregando...</p>
      </main>
    );
  }

  const { tenant } = data;

  if (done) {
    const when = new Date(done.appointment.startAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <main className="book">
        <div className="card confirm">
          <div className="success" style={{ fontSize: 40, margin: 0 }}>✓</div>
          <h1>Agendamento confirmado!</h1>
          <div className="big">{when}</div>
          <p>
            {done.appointment.service.name} com {done.appointment.professional.name}
            <br />
            {formatBRL(done.appointment.priceCents)}
          </p>
          <p className="muted">
            {tenant.name}
            {tenant.address ? ` · ${tenant.address}` : ""}
            {tenant.phone ? ` · ${tenant.phone}` : ""}
          </p>
          <p className="muted">Precisa remarcar ou cancelar? Fale diretamente com a barbearia.</p>
          <button onClick={reset}>Fazer outro agendamento</button>
        </div>
      </main>
    );
  }

  if (data.services.length === 0 || data.professionals.length === 0) {
    return (
      <main className="book">
        <div className="card confirm">
          <h1>{tenant.name}</h1>
          <p className="muted">
            A agenda online ainda não está disponível.{tenant.phone ? ` Ligue para ${tenant.phone}.` : ""}
          </p>
        </div>
      </main>
    );
  }

  const selectedService = data.services.find((s) => s.id === serviceId);
  const selectedPro = proOptions.find((p) => p.id === proId);
  const price = selectedService
    ? (selectedPro ? effectivePrice(selectedService, selectedPro) : selectedService.priceCents)
    : 0;

  return (
    <main className="book">
      <h1>{tenant.name}</h1>
      <p className="muted">{[tenant.address, tenant.phone].filter(Boolean).join(" · ")}</p>

      <div className="card">
        <p className="step-title">1. Escolha o serviço</p>
        {data.services
          .filter((s) => data.professionals.some((p) => p.services.some((l) => l.serviceId === s.id)))
          .map((s) => {
            const { minPriceCents, maxPriceCents, shownPriceCents, hasPriceRange } = servicePriceDisplay(
              s,
              data.professionals,
              s.id === serviceId ? selectedPro : undefined,
            );

            return (
              <button key={s.id} className={`opt${s.id === serviceId ? " active" : ""}`} onClick={() => pickService(s.id)}>
                <span>
                  <strong>{s.name}</strong>
                  <br />
                  <span className="muted">{s.durationMin} min</span>
                </span>
                <span
                  className="price"
                  aria-label={
                    hasPriceRange
                      ? `Faixa de preço: ${formatBRL(minPriceCents)} a ${formatBRL(maxPriceCents)}`
                      : `Preço: ${formatBRL(shownPriceCents)}`
                  }
                >
                  {hasPriceRange
                    ? `${formatBRL(minPriceCents)} – ${formatBRL(maxPriceCents)}`
                    : formatBRL(shownPriceCents)}
                </span>
              </button>
            );
          })}
      </div>

      {serviceId && proOptions.length > 1 && (
        <div className="card">
          <p className="step-title">2. Escolha o profissional</p>
          {proOptions.map((p) => (
            <button
              key={p.id}
              className={`opt${p.id === proId ? " active" : ""}`}
              onClick={() => {
                setProId(p.id);
                setSlot("");
              }}
            >
              <strong>{p.name}</strong>
            </button>
          ))}
        </div>
      )}

      {serviceId && proId && (
        <div className="card">
          <p className="step-title">{proOptions.length > 1 ? "3" : "2"}. Escolha o dia e o horário</p>
          <div className="chips">
            {dates.map((d) => {
              const c = chip(d);
              return (
                <button key={d} className={`chip${d === date ? " active" : ""}`} onClick={() => setDate(d)}>
                  <small>{c.wd}</small>
                  <strong>{c.label}</strong>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            {slots === null ? (
              <p className="muted">Buscando horários...</p>
            ) : slots.length === 0 ? (
              <p className="muted">Sem horários livres neste dia. Tente outro dia.</p>
            ) : (
              <div className="slotgrid">
                {slots.map((s) => (
                  <button key={s} className={s === slot ? "active" : undefined} onClick={() => setSlot(s)}>
                    {formatTime(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {slot && (
        <form className="card" onSubmit={submit}>
          <p className="step-title">Seus dados</p>
          <p className="muted">
            {selectedService?.name} · {formatBRL(price)} · {formatTime(slot)}
          </p>
          <label htmlFor="bname">Nome</label>
          <input id="bname" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="bphone">Telefone (WhatsApp)</label>
          <input id="bphone" required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Confirmando..." : "Confirmar agendamento"}
          </button>
          <p className="legal">
            Ao confirmar, você autoriza a barbearia a usar seu nome e telefone para este atendimento e para contato
            sobre o agendamento.
          </p>
        </form>
      )}

      {!slot && error && <div className="error" role="alert">{error}</div>}
    </main>
  );
}
