import MarketplaceExperience from "@/components/public/MarketplaceExperience";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export const metadata = {
  title: "Encontre sua barbearia | BarbeiroPro",
  description: "Descubra barbearias e pesquise pelos serviços que você procura.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <MarketplaceExperience
      name={readSearchValue(params.name)}
      service={readSearchValue(params.service)}
      after={readSearchValue(params.after)}
    />
  );
}
