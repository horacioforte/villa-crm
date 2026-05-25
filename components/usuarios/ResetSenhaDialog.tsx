"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";

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
import { resetSenhaSchema } from "@/lib/validations/usuario";

type ResetSenhaDialogProps = {
  aberto: boolean;
  usuarioId: string | null;
  usuarioNome: string | null;
  onFechar: () => void;
  onSalvar: () => void;
};

export function ResetSenhaDialog({
  aberto,
  usuarioId,
  usuarioNome,
  onFechar,
  onSalvar,
}: ResetSenhaDialogProps) {
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleClose() {
    setSenha("");
    setError(null);
    onFechar();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuarioId) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const data = resetSenhaSchema.parse({ senha });
      const response = await fetch(`/api/usuarios/${usuarioId}/reset-senha`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao resetar senha.");
      }

      toast.success("Senha resetada com sucesso.");
      onSalvar();
      handleClose();
    } catch (submitError) {
      if (submitError instanceof ZodError) {
        setError(submitError.issues[0]?.message ?? "Senha invalida.");
        toast.error("Revise a nova senha.");
      } else {
        toast.error(
          submitError instanceof Error
            ? submitError.message
            : "Nao foi possivel resetar a senha.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
            Resetar senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para {usuarioNome ?? "este usuario"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="mb-2 text-[#1A2E5A]">Nova senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(event) => {
                setSenha(event.target.value);
                setError(null);
              }}
              placeholder="Minimo de 8 caracteres"
              className="h-11 rounded-2xl bg-[#F4F6FA]"
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetando...
                </>
              ) : (
                "Resetar senha"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
