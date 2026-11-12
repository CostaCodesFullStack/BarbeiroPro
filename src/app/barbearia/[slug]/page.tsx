import { notFound } from "next/navigation";
import BarbershopProfile from "@/components/public/BarbershopProfile";
import PublicShell from "@/components/public/PublicShell";
import { getPublicBarbershopProfile } from "@/lib/public/marketplace";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export const metadata = {
  title: "Perfil da barbearia | BarbeiroPro",
  description: "Conheça os serviços e profissionais da barbearia.",
};

export default async function PublicBarbershopPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getPublicBarbershopProfile(slug);
  if (!profile) notFound();

  return (
    <PublicShell>
      <BarbershopProfile profile={profile} />
    </PublicShell>
  );
}
