import { notFound } from "next/navigation";
import { CarteiraEstratPage } from "@/components/inteligencia/CarteiraEstratPage";

const slugsPermitidos = new Set([
  "mcmv",
  "construtoras-brasil",
  "concreteiras",
  "pre-moldados",
  "revendas-caminhoes",
]);

export default async function CarteiraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slugsPermitidos.has(slug)) {
    notFound();
  }

  return <CarteiraEstratPage slug={slug} />;
}
