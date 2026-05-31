"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InlineCreateDialog } from "@/components/ui/inline-create-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ObraCriada = {
  id: string;
  nome: string;
  empresaId: string;
  endereco?: string | null;
  cidade?: string | null;
};

type NovaObraInlineProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onCriada: (obra: ObraCriada) => void;
};

export function NovaObraInline({
  open,
  onOpenChange,
  empresaId,
  onCriada,
}: NovaObraInlineProps) {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!empresaId) {
      toast.error("Selecione uma empresa primeiro.");
      return;
    }

    if (!nome.trim()) {
      toast.error("Informe o nome da obra.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/obras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          endereco: endereco || null,
          cidade: cidade || null,
          empresaId,
          status: "PLANEJADA",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao criar obra.");
      }

      const obra = await response.json();
      onCriada(obra);
      setNome("");
      setEndereco("");
      setCidade("");
      toast.success("Obra criada e selecionada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel criar a obra.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <InlineCreateDialog
      title="Nova obra"
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nova-obra-nome">Nome da obra*</Label>
          <Input
            id="nova-obra-nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nova-obra-endereco">Endereco</Label>
          <Input
            id="nova-obra-endereco"
            value={endereco}
            onChange={(event) => setEndereco(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nova-obra-cidade">Cidade</Label>
          <Input
            id="nova-obra-cidade"
            value={cidade}
            onChange={(event) => setCidade(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-2xl"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !empresaId}
            className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </form>
    </InlineCreateDialog>
  );
}
