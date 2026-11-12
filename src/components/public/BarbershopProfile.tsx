import Link from "next/link";
import Button from "@/components/ui/Button";
import type { PublicBarbershopProfile as PublicBarbershopProfileData } from "@/lib/public/marketplace";
import styles from "./BarbershopProfile.module.css";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatPrice(priceCents: number): string {
  return currency.format(priceCents / 100);
}

function formatPriceRange(minPriceCents: number, maxPriceCents: number): string {
  if (minPriceCents === maxPriceCents) return formatPrice(minPriceCents);
  return `${formatPrice(minPriceCents)} – ${formatPrice(maxPriceCents)}`;
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}

export default function BarbershopProfile({
  profile,
}: {
  profile: PublicBarbershopProfileData;
}) {
  const address = profile.address?.trim();
  const phone = profile.phone?.trim();
  const hasDialablePhone = Boolean(phone?.replace(/\D/g, ""));

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Navegação estrutural">
          <Link href="/">Marketplace</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{profile.name}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.identity}>
            <p className={styles.eyebrow}>Perfil da barbearia</p>
            <h1 className={styles.name}>{profile.name}</h1>
            <div className={styles.contactDetails}>
              {address ? (
                <address className={styles.contactItem}>
                  <span className={styles.contactLabel}>Endereço</span>
                  <span>{address}</span>
                </address>
              ) : null}
              {phone ? (
                <p className={styles.contactItem}>
                  <span className={styles.contactLabel}>Telefone</span>
                  {hasDialablePhone ? <a href={phoneHref(phone)}>{phone}</a> : <span>{phone}</span>}
                </p>
              ) : null}
            </div>
          </div>

          <aside className={styles.bookingCard} aria-labelledby="booking-title">
            <p className={styles.bookingEyebrow}>Agendamento online</p>
            <h2 id="booking-title">Escolha seu próximo horário</h2>
            <p className={styles.bookingDescription}>
              Consulte os serviços, profissionais e horários disponíveis.
            </p>
            {profile.bookingAllowed ? (
              <Link
                className="ui-button ui-button--primary"
                href={`/b/${profile.slug}`}
                aria-label={`Agendar em ${profile.name}`}
              >
                Agendar nesta barbearia
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <div>
                <Button variant="secondary" disabled className={styles.unavailableButton}>
                  Agendamento indisponível
                </Button>
                <p className={styles.unavailableNote} role="status">
                  Os agendamentos online estão indisponíveis no momento.
                </p>
              </div>
            )}
          </aside>
        </header>

        <section className={styles.section} aria-labelledby="services-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Catálogo</p>
              <h2 id="services-title">Serviços</h2>
            </div>
            <p className={styles.sectionCount}>
              {profile.services.length} {profile.services.length === 1 ? "serviço" : "serviços"}
            </p>
          </div>

          <div className={styles.servicesGrid}>
            {profile.services.map((service, index) => (
              <article
                className={`card ui-card ${styles.serviceCard}`}
                key={`${service.name}-${service.durationMin}-${index}`}
              >
                <h3>{service.name}</h3>
                <dl className={styles.serviceDetails}>
                  <div>
                    <dt>Duração</dt>
                    <dd>{service.durationMin} min</dd>
                  </div>
                  <div>
                    <dt>Preço</dt>
                    <dd>{formatPriceRange(service.minPriceCents, service.maxPriceCents)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="professionals-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Equipe</p>
              <h2 id="professionals-title">Profissionais</h2>
            </div>
            <p className={styles.sectionCount}>
              {profile.professionals.length} {profile.professionals.length === 1 ? "profissional" : "profissionais"}
            </p>
          </div>

          <div className={styles.professionalsGrid}>
            {profile.professionals.map((professional, index) => {
              const workingHours = professional.workingHours.filter(
                (hour) => Number.isInteger(hour.weekday) && WEEKDAYS[hour.weekday] !== undefined,
              );

              return (
                <article
                  className={`card ui-card ${styles.professionalCard}`}
                  key={`${professional.name}-${index}`}
                >
                  <header className={styles.professionalHeading}>
                    <p className={styles.cardEyebrow}>Profissional</p>
                    <h3>{professional.name}</h3>
                  </header>

                  <div className={styles.professionalServices}>
                    <h4>Serviços atendidos</h4>
                    <ul>
                      {professional.services.map((service, serviceIndex) => (
                        <li key={`${service.name}-${serviceIndex}`}>
                          <span>{service.name}</span>
                          <span className={styles.professionalServiceMeta}>
                            {service.durationMin} min · {formatPrice(service.priceCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {workingHours.length > 0 ? (
                    <div className={styles.workingHours}>
                      <h4>Horários</h4>
                      <ul>
                        {workingHours.map((hour, hourIndex) => (
                          <li key={`${hour.weekday}-${hour.startTime}-${hourIndex}`}>
                            <span>{WEEKDAYS[hour.weekday]}</span>
                            <span>{hour.startTime} – {hour.endTime}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
