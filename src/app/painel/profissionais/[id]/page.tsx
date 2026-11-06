import ProfissionalDetalheClient from "@/components/ProfissionalDetalheClient";

export default async function ProfissionalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfissionalDetalheClient id={id} />;
}
