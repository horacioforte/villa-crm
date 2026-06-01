"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  feedbackAreas,
  tipoFeedbackConfig,
  type TipoFeedbackValue,
} from "@/components/feedback/feedback-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackModalProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: () => void;
};

export function FeedbackModal({
  aberto,
  onFechar,
  onSalvar,
}: FeedbackModalProps) {
  const [tipo, setTipo] = useState<TipoFeedbackValue>("BUG");
  const [titulo, setTitulo] = useState("");
  const [area, setArea] = useState("GERAL");
  const [descricao, setDescricao] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function resetForm() {
    setTipo("BUG");
    setTitulo("");
    setArea("GERAL");
    setDescricao("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!titulo.trim()) {
      toast.error("Informe o titulo do feedback.");
      return;
    }

    if (!descricao.trim()) {
      toast.error("Descreva o feedback antes de salvar.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          area: area === "GERAL" ? null : area,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao registrar feedback.");
      }

      toast.success("Feedback registrado com sucesso.");
      resetForm();
      onSalvar();
      onFechar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel registrar o feedback.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) {
          onFechar();
        }
      }}
    >
      <DialogContent className="rounded-3xl p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
            Novo feedback
          </DialogTitle>
          <DialogDescription>
            Reporte bugs ou sugestoes para melhorar o Villa CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(tipoFeedbackConfig).map(([value, config]) => {
                const ativo = tipo === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipo(value as TipoFeedbackValue)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                      ativo
                        ? "border-[#1E4FAB] bg-[#1E4FAB] text-white"
                        : "border-[#D7DEEA] bg-[#F4F6FA] text-[#1A2E5A] hover:border-[#1E4FAB]",
                    )}
                  >
                    {config.emoji} {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedbackTitulo">Titulo</Label>
            <Input
              id="feedbackTitulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex: Botao salvar nao funciona no modal de tarefas"
              className="h-11 rounded-2xl bg-[#F4F6FA]"
            />
          </div>

          <div className="space-y-2">
            <Label>Area do app</Label>
            <Select
              value={area}
              onValueChange={(value) => setArea(value ?? "GERAL")}
            >
              <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {feedbackAreas.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedbackDescricao">Descricao</Label>
            <Textarea
              id="feedbackDescricao"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Descreva o que aconteceu ou o que voce gostaria que fosse diferente..."
              rows={4}
              className="resize-none rounded-2xl bg-[#F4F6FA]"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onFechar}
              className="rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar feedback
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
