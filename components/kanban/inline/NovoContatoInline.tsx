"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InlineCreateDialog } from "@/components/ui/inline-create-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContatoCriado = {
  id: string;
  nome: string;
  cargo?: string | null;
  whatsapp?: string | null;
  empresaId: string;
};

type NovoContatoInlineProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onCriada: (contato: ContatoCriado) => void;
};

export function NovoContatoInline({
  open,
  onOpenChange,
  empresaId,
  onCriada,
}: NovoContatoInlineProps) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!empresaId) {
      toast.error("Selecione uma empresa primeiro.");
      return;
    }

    if (!nome.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contatos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          cargo: cargo || null,
          whatsapp: telefone || null,
          empresaId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao criar contato.");
      }

      const contato = await response.json();
      onCriada(contato);
      setNome("");
      setCargo("");
      setTelefone("");
      toast.success("Contato criado e selecionado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel criar o contato.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <InlineCreateDialog
      title="Novo contato"
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="novo-contato-nome">Nome*</Label>
          <Input
            id="novo-contato-nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="novo-contato-cargo">Cargo</Label>
          <Input
            id="novo-contato-cargo"
            value={cargo}
            onChange={(event) => setCargo(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="novo-contato-telefone">Telefone/WhatsApp</Label>
          <Input
            id="novo-contato-telefone"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
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
