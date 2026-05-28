import { PropostaPageClient } from "@/components/propostas/PropostaPageClient";

export default async function PropostaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PropostaPageClient id={id} />;
}
