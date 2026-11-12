import Link from "next/link";
import { Suspense } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import PublicShell from "@/components/public/PublicShell";
import {
  listPublicBarbershops,
  type PublicBarbershopCard,
  type PublicMarketplaceQuery,
} from "@/lib/public/marketplace";
import styles from "./MarketplaceExperience.module.css";

type MarketplaceExperienceProps = {
  name: string;
  service: string;
  after: string;
};

function marketplaceHref(query: PublicMarketplaceQuery): string {
  const params = new URLSearchParams();
  if (query.name) params.set("name", query.name);
  if (query.service) params.set("service", query.service);
  if (query.after) params.set("after", query.after);

  const search = params.toString();
  return search ? `/?${search}` : "/";
}

function LoadingResults() {
  return (
    <div className={styles.loadingRegion}>
      <LoadingState label="Carregando barbearias..." />
      <div className={styles.resultsGrid} aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className={`card ui-card ${styles.barbershopCard} ${styles.skeletonCard}`} key={index}>
            <Skeleton className={styles.skeletonTitle} />
            <Skeleton className={styles.skeletonLine} />
            <Skeleton className={styles.skeletonLineShort} />
            <div className={styles.skeletonActions}>
              <Skeleton className={styles.skeletonButton} />
              <Skeleton className={styles.skeletonButton} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarbershopCard({ barbershop }: { barbershop: PublicBarbershopCard }) {
  const address = barbershop.address?.trim();

  return (
    <article className={`card ui-card ${styles.barbershopCard}`}>
      <div className={styles.cardContent}>
        <p className={styles.cardEyebrow}>Barbearia</p>
        <h3 className={styles.cardTitle}>{barbershop.name}</h3>
        {address ? (
          <p className={styles.address}>
            <span className={styles.metaLabel}>Endereço</span>
            {address}
          </p>
        ) : null}

        <div className={styles.services}>
          <p className={styles.metaLabel}>Serviços</p>
          <ul className={styles.serviceList} aria-label={`Serviços oferecidos por ${barbershop.name}`}>
            {barbershop.services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.cardActions}>
        <Link
          className="ui-button ui-button--secondary"
          href={`/barbearia/${barbershop.slug}`}
          aria-label={`Conhecer ${barbershop.name}`}
        >
          Conhecer
        </Link>
        {barbershop.bookingAllowed ? (
          <Link
            className="ui-button ui-button--primary"
            href={`/b/${barbershop.slug}`}
            aria-label={`Agendar em ${barbershop.name}`}
          >
            Agendar
          </Link>
        ) : null}
      </div>
    </article>
  );
}

async function MarketplaceResults({
  name,
  service,
  after,
}: MarketplaceExperienceProps) {
  try {
    const result = await listPublicBarbershops({ name, service, after });

    if (result.items.length === 0) {
      const filtered = Boolean(name || service);
      return (
        <EmptyState
          title={filtered ? "Nenhuma barbearia encontrada" : "Ainda não há barbearias publicadas"}
          description={
            filtered
              ? "Tente ajustar o nome ou o serviço e faça uma nova busca."
              : "As barbearias aparecerão aqui quando estiverem prontas para receber clientes."
          }
          action={
            filtered ? (
              <Link className="ui-button ui-button--secondary" href="/">
                Limpar filtros
              </Link>
            ) : undefined
          }
        />
      );
    }

    const nextHref = result.nextCursor
      ? marketplaceHref({ name, service, after: result.nextCursor })
      : null;

    return (
      <>
        <p className={styles.resultsCount} aria-live="polite">
          {result.items.length} {result.items.length === 1 ? "barbearia nesta página" : "barbearias nesta página"}
        </p>
        <div className={styles.resultsGrid}>
          {result.items.map((barbershop) => (
            <BarbershopCard key={barbershop.slug} barbershop={barbershop} />
          ))}
        </div>
        {nextHref ? (
          <nav className={styles.pagination} aria-label="Paginação de barbearias">
            <Link className="ui-button ui-button--secondary" href={nextHref}>
              Carregar mais barbearias
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        ) : null}
      </>
    );
  } catch {
    const retryHref = marketplaceHref({ name, service, after });
    return (
      <ErrorState title="Não foi possível carregar as barbearias">
        <p>A vitrine não respondeu. Tente carregar os resultados novamente.</p>
        <a className="ui-button ui-button--secondary" href={retryHref}>
          Tentar novamente
        </a>
      </ErrorState>
    );
  }
}

export default function MarketplaceExperience({ name, service, after }: MarketplaceExperienceProps) {
  return (
    <PublicShell>
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="marketplace-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BarbeiroPro <span aria-hidden="true">/</span> Marketplace</p>
            <h1 className={styles.heroTitle} id="marketplace-title">
              Seu próximo corte começa por aqui<span>.</span>
            </h1>
            <p className={styles.heroDescription}>
              Descubra barbearias e encontre os serviços que você procura.
            </p>
          </div>

          <div className={`card ui-card ${styles.searchPanel}`}>
            <div className={styles.searchHeading}>
              <p className={styles.searchKicker}>Encontre seu lugar</p>
              <h2>Busque uma barbearia</h2>
              <p>Pesquise pelo nome do estabelecimento ou por um serviço.</p>
            </div>
            <form action="/" method="get" role="search" aria-label="Buscar barbearias" className={styles.searchForm}>
              <Field id="marketplace-name" label="Nome da barbearia">
                <Input
                  id="marketplace-name"
                  name="name"
                  type="search"
                  maxLength={100}
                  placeholder="Digite o nome"
                  defaultValue={name}
                  autoComplete="off"
                />
              </Field>
              <Field id="marketplace-service" label="Serviço">
                <Input
                  id="marketplace-service"
                  name="service"
                  type="search"
                  maxLength={100}
                  placeholder="Ex.: corte ou barba"
                  defaultValue={service}
                  autoComplete="off"
                />
              </Field>
              <Button type="submit" variant="primary" className={styles.searchButton}>
                Buscar barbearias
              </Button>
            </form>
            {name || service ? (
              <Link className={styles.clearFilters} href="/">
                Limpar busca
              </Link>
            ) : null}
          </div>
        </section>

        <section className={styles.directory} aria-labelledby="directory-title">
          <div className={styles.directoryHeading}>
            <div>
              <p className={styles.sectionKicker}>Descoberta</p>
              <h2 id="directory-title">Barbearias para conhecer</h2>
              <p>Veja serviços e acesse o perfil de cada estabelecimento.</p>
            </div>
          </div>
          <Suspense fallback={<LoadingResults />}>
            <MarketplaceResults name={name} service={service} after={after} />
          </Suspense>
        </section>

        <aside className={styles.ownerCallout} aria-labelledby="owner-title">
          <div>
            <p className={styles.sectionKicker}>Para proprietários</p>
            <h2 id="owner-title">Sua barbearia também pode estar aqui.</h2>
            <p>Crie sua conta para organizar a operação e disponibilizar o agendamento online.</p>
          </div>
          <Link className="ui-button ui-button--primary" href="/cadastro">
            Começar cadastro
          </Link>
        </aside>
      </main>
    </PublicShell>
  );
}
