"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InlineCreateDialog } from "@/components/ui/inline-create-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EmpresaCriada = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj?: string | null;
  telefone?: string | null;
};

type NovaEmpresaInlineProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriada: (empresa: EmpresaCriada) => void;
};

export function NovaEmpresaInline({
  open,
  onOpenChange,
  onCriada,
}: NovaEmpresaInlineProps) {
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nomeFantasia.trim()) {
      toast.error("Informe o nome fantasia.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razaoSocial: nomeFantasia,
          nomeFantasia,
          cnpj: cnpj || null,
          telefone: telefone || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao criar empresa.");
      }

      const empresa = await response.json();
      onCriada(empresa);
      setNomeFantasia("");
      setCnpj("");
      setTelefone("");
      toast.success("Empresa criada e selecionada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel criar a empresa.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <InlineCreateDialog
      title="Nova empresa"
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nova-empresa-nome">Nome fantasia*</Label>
          <Input
            id="nova-empresa-nome"
            value={nomeFantasia}
            onChange={(event) => setNomeFantasia(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nova-empresa-cnpj">CNPJ</Label>
          <Input
            id="nova-empresa-cnpj"
            value={cnpj}
            onChange={(event) => setCnpj(event.target.value)}
            className="h-11 rounded-2xl bg-[#F4F6FA]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nova-empresa-telefone">Telefone</Label>
          <Input
            id="nova-empresa-telefone"
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
            disabled={isSubmitting}
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
