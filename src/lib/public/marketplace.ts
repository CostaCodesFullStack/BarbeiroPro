import type { Prisma } from "@prisma/client";
import { canTakeBookings } from "@/lib/billing/access";
import { prisma, withTenant } from "@/lib/db";
import { findPublicTenant } from "@/lib/public/guard";

/** Server-side only: never import this module from a Client Component. */

const MARKETPLACE_PAGE_SIZE = 12;
const TENANT_BATCH_SIZE = 24;
const TENANT_QUERY_CONCURRENCY = 4;
const VALID_SLUG = /^[a-z0-9-]{3,40}$/;

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  address: true,
  status: true,
  trialEndsAt: true,
  subscription: { select: { status: true, currentPeriodEnd: true, accessEndsAt: true, cancellationConfirmed: true } },
} satisfies Prisma.TenantSelect;

type TenantCandidate = Prisma.TenantGetPayload<{ select: typeof tenantSelect }>;

export type PublicBarbershopCard = {
  name: string;
  slug: string;
  address: string | null;
  services: string[];
  /** Gate de acesso de canTakeBookings; não significa que há slot livre agora. */
  bookingAllowed: boolean;
};

export type PublicMarketplacePage = {
  items: PublicBarbershopCard[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type PublicBarbershopProfile = {
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  /** Resultado de canTakeBookings(); horários/slots continuam sob responsabilidade de /b/[slug]. */
  bookingAllowed: boolean;
  services: Array<{
    name: string;
    durationMin: number;
    minPriceCents: number;
    maxPriceCents: number;
  }>;
  professionals: Array<{
    name: string;
    workingHours: Array<{
      weekday: number;
      startTime: string;
      endTime: string;
      breakStart: string | null;
      breakEnd: string | null;
    }>;
    services: Array<{
      name: string;
      durationMin: number;
      priceCents: number;
    }>;
  }>;
};

export type PublicMarketplaceQuery = {
  name?: string | null;
  service?: string | null;
  after?: string | null;
};

function normalizeSearchTerm(value?: string | null): string {
  return value?.trim().slice(0, 100).toLocaleLowerCase("pt-BR") ?? "";
}

function isValidName(value: string): boolean {
  const name = value.trim();
  return name.length >= 2 && name.length <= 100;
}

function isValidSlug(value: string): boolean {
  return VALID_SLUG.test(value);
}

function matchesTerm(value: string, term: string): boolean {
  return value.toLocaleLowerCase("pt-BR").includes(term);
}

function hasBookableAccess(tenant: TenantCandidate): boolean {
  return canTakeBookings({
    tenantStatus: tenant.status,
    subscriptionStatus: tenant.subscription?.status ?? null,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEnd: tenant.subscription?.currentPeriodEnd ?? null,
    accessEndsAt: tenant.subscription?.accessEndsAt ?? null,
    cancellationConfirmed: tenant.subscription?.cancellationConfirmed ?? false,
  });
}

function validAssociationWhere(tenantId: string) {
  return {
    tenantId,
    professional: { is: { tenantId, active: true } },
    service: { is: { tenantId, active: true } },
  };
}

async function getListingServices(tenantId: string): Promise<string[]> {
  const links = await withTenant(tenantId, (tx) =>
    tx.professionalService.findMany({
      where: validAssociationWhere(tenantId),
      select: { service: { select: { name: true } } },
    }),
  );

  return [...new Set(links.map((link) => link.service.name.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        results[index] = await map(items[index]);
      }
    }),
  );

  return results;
}

/** Lista estabelecimentos publicados; a assinatura só afeta o CTA de agendamento. */
export async function listPublicBarbershops(
  query: PublicMarketplaceQuery = {},
): Promise<PublicMarketplacePage> {
  const nameTerm = normalizeSearchTerm(query.name);
  const serviceTerm = normalizeSearchTerm(query.service);
  const after = query.after && isValidSlug(query.after) ? query.after : undefined;
  const matches: PublicBarbershopCard[] = [];
  let scanAfter = after;

  // A busca por serviço precisa conferir as associações no contexto RLS de cada tenant.
  // O cursor e os lotes limitam memória e concorrência; o custo continua proporcional aos tenants varridos.
  while (matches.length <= MARKETPLACE_PAGE_SIZE) {
    const where: Prisma.TenantWhereInput = {
      status: "ACTIVE",
      ...(nameTerm ? { name: { contains: nameTerm, mode: "insensitive" } } : {}),
      ...(scanAfter ? { slug: { gt: scanAfter } } : {}),
    };

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { slug: "asc" },
      take: TENANT_BATCH_SIZE,
      select: tenantSelect,
    });
    if (tenants.length === 0) break;

    const cards = await mapWithConcurrency(tenants, TENANT_QUERY_CONCURRENCY, async (tenant) => {
      if (!isValidName(tenant.name) || !isValidSlug(tenant.slug)) return null;
      if (nameTerm && !matchesTerm(tenant.name, nameTerm)) return null;

      const services = await getListingServices(tenant.id);
      if (services.length === 0) return null;
      if (serviceTerm && !services.some((name) => matchesTerm(name, serviceTerm))) return null;

      return {
        name: tenant.name.trim(),
        slug: tenant.slug,
        address: tenant.address,
        services: services.slice(0, 3),
        bookingAllowed: hasBookableAccess(tenant),
      } satisfies PublicBarbershopCard;
    });

    matches.push(...cards.filter((card): card is PublicBarbershopCard => card !== null));
    scanAfter = tenants[tenants.length - 1].slug;

    if (tenants.length < TENANT_BATCH_SIZE || matches.length > MARKETPLACE_PAGE_SIZE) break;
  }

  const hasMore = matches.length > MARKETPLACE_PAGE_SIZE;
  const items = matches.slice(0, MARKETPLACE_PAGE_SIZE);

  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1].slug : null,
  };
}

async function getProfileLinks(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.professionalService.findMany({
      where: validAssociationWhere(tenantId),
      select: {
        professionalId: true,
        serviceId: true,
        customPriceCents: true,
        professional: {
          select: {
            name: true,
            workingHours: {
              select: {
                weekday: true,
                startTime: true,
                endTime: true,
                breakStart: true,
                breakEnd: true,
              },
              orderBy: { weekday: "asc" },
            },
          },
        },
        service: {
          select: { name: true, durationMin: true, priceCents: true },
        },
      },
    }),
  );
}

/** Busca um perfil elegível sem exigir assinatura ativa e sem retornar dados de cobrança. */
export async function getPublicBarbershopProfile(
  slug: string,
): Promise<PublicBarbershopProfile | null> {
  const tenant = await findPublicTenant(slug);
  if (!tenant || tenant.status !== "ACTIVE" || !isValidName(tenant.name)) return null;

  const links = await getProfileLinks(tenant.id);
  if (links.length === 0) return null;

  const servicesById = new Map<
    string,
    { name: string; durationMin: number; minPriceCents: number; maxPriceCents: number }
  >();
  const professionalsById = new Map<
    string,
    {
      name: string;
      workingHours: Array<{
        weekday: number;
        startTime: string;
        endTime: string;
        breakStart: string | null;
        breakEnd: string | null;
      }>;
      services: Map<string, { name: string; durationMin: number; priceCents: number }>;
    }
  >();

  for (const link of links) {
    const priceCents = link.customPriceCents ?? link.service.priceCents;
    const service = servicesById.get(link.serviceId);
    if (service) {
      service.minPriceCents = Math.min(service.minPriceCents, priceCents);
      service.maxPriceCents = Math.max(service.maxPriceCents, priceCents);
    } else {
      servicesById.set(link.serviceId, {
        name: link.service.name,
        durationMin: link.service.durationMin,
        minPriceCents: priceCents,
        maxPriceCents: priceCents,
      });
    }

    let professional = professionalsById.get(link.professionalId);
    if (!professional) {
      professional = {
        name: link.professional.name,
        workingHours: link.professional.workingHours,
        services: new Map(),
      };
      professionalsById.set(link.professionalId, professional);
    }
    professional.services.set(link.serviceId, {
      name: link.service.name,
      durationMin: link.service.durationMin,
      priceCents,
    });
  }

  return {
    name: tenant.name.trim(),
    slug,
    phone: tenant.phone,
    address: tenant.address,
    bookingAllowed: tenant.bookable,
    services: [...servicesById.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    professionals: [...professionalsById.values()]
      .map((professional) => ({
        name: professional.name,
        workingHours: professional.workingHours,
        services: [...professional.services.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
