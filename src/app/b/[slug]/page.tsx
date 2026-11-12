import { notFound } from "next/navigation";
import BookingClient from "@/components/BookingClient";
import PublicShell from "@/components/public/PublicShell";
import { findPublicTenant } from "@/lib/public/guard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tenant = await findPublicTenant(slug);
  return { title: tenant ? `${tenant.name} · Agendamento online` : "Agendamento online" };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await findPublicTenant(slug);
  if (!tenant) notFound();

  if (!tenant.bookable) {
    return (
      <PublicShell mode="booking">
        <main className="book">
          <div className="card confirm">
            <h1>{tenant.name}</h1>
            <p className="muted">
              Os agendamentos online estão indisponíveis no momento. Entre em contato diretamente com a barbearia
              {tenant.phone ? `: ${tenant.phone}` : "."}
            </p>
          </div>
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell mode="booking">
      <BookingClient slug={slug} />
    </PublicShell>
  );
}
