"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  statusFeedbackConfig,
  tipoFeedbackConfig,
  type StatusFeedbackValue,
  type TipoFeedbackValue,
} from "@/components/feedback/feedback-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type FeedbackDetalhe = {
  id: string;
  numero: number;
  tipo: TipoFeedbackValue;
  titulo: string;
  descricao: string;
  area: string | null;
  status: StatusFeedbackValue;
  respostaAdmin: string | null;
  criadoEm: string;
  autor: {
    id: string;
    nome: string;
    email: string | null;
    papel: string;
  };
};

type FeedbackDetalheModalProps = {
  aberto: boolean;
  feedback: FeedbackDetalhe | null;
  onFechar: () => void;
  onSalvar: () => void;
};

export function FeedbackDetalheModal({
  aberto,
  feedback,
  onFechar,
  onSalvar,
}: FeedbackDetalheModalProps) {
  const [status, setStatus] = useState<StatusFeedbackValue>("RECEBIDO");
  const [respostaAdmin, setRespostaAdmin] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!feedback || !aberto) {
      return;
    }

    setStatus(feedback.status);
    setRespostaAdmin(feedback.respostaAdmin ?? "");
  }, [aberto, feedback]);

  if (!feedback) {
    return null;
  }

  const feedbackAtual = feedback;
  const tipoConfig = tipoFeedbackConfig[feedback.tipo];

  async function handleSalvar() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/feedback/${feedbackAtual.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          respostaAdmin,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao atualizar feedback.");
      }

      toast.success("Feedback atualizado.");
      onSalvar();
      onFechar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar o feedback.",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
            Feedback #{feedback.numero}
          </DialogTitle>
          <DialogDescription>
            Analise a solicitacao e responda ao usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-3xl border border-[#D7DEEA] bg-[#F4F6FA] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={tipoConfig.className}>
                {tipoConfig.emoji} {tipoConfig.label}
              </Badge>
              <Badge className={statusFeedbackConfig[feedback.status].className}>
                {statusFeedbackConfig[feedback.status].label}
              </Badge>
              {feedback.area ? (
                <Badge variant="outline">{feedback.area}</Badge>
              ) : null}
            </div>
            <h3 className="mt-3 text-lg font-bold text-[#1A2E5A]">
              {feedback.titulo}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#475467]">
              {feedback.descricao}
            </p>
            <p className="mt-3 text-xs font-semibold text-[#667085]">
              Enviado por {feedback.autor.nome} ({feedback.autor.papel})
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFeedbackValue)}
            >
              <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusFeedbackConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="respostaAdmin">Resposta ao usuario</Label>
            <Textarea
              id="respostaAdmin"
              value={respostaAdmin}
              onChange={(event) => setRespostaAdmin(event.target.value)}
              placeholder="Ex: Identificamos o problema. Sera corrigido na proxima atualizacao."
              rows={3}
              className="resize-none rounded-2xl bg-[#F4F6FA]"
            />
          </div>
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
            type="button"
            onClick={handleSalvar}
            disabled={isSaving}
            className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar alteracoes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
