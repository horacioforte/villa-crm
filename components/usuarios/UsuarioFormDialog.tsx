"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";

import type { PapelUsuario } from "@/app/generated/prisma/client";
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
import {
  papelUsuarioValues,
  usuarioCreateSchema,
  usuarioPatchSchema,
  type UsuarioCreateInput,
} from "@/lib/validations/usuario";

type FilialOption = {
  id: string;
  nome: string;
};

type UsuarioListItem = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  filialId: string | null;
  filial: FilialOption | null;
  lastLoginAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type UsuarioFormDialogProps = {
  aberto: boolean;
  usuario: UsuarioListItem | null;
  filiais: FilialOption[];
  onFechar: () => void;
  onSalvar: (usuario: UsuarioListItem) => void;
};

type FieldErrors = Partial<Record<keyof UsuarioCreateInput, string>>;

const NONE_VALUE = "__none__";

const papelLabels: Record<PapelUsuario, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  COMERCIAL: "Comercial",
  OPERACIONAL: "Operacional",
};

const initialForm: UsuarioCreateInput = {
  nome: "",
  email: "",
  senha: "",
  papel: "COMERCIAL",
  filialId: NONE_VALUE,
};

function getInitialForm(usuario: UsuarioListItem | null): UsuarioCreateInput {
  if (!usuario) {
    return initialForm;
  }

  return {
    nome: usuario.nome,
    email: usuario.email,
    senha: "",
    papel: usuario.papel,
    filialId: usuario.filialId ?? NONE_VALUE,
  };
}

export function UsuarioFormDialog({
  aberto,
  usuario,
  filiais,
  onFechar,
  onSalvar,
}: UsuarioFormDialogProps) {
  const [form, setForm] = useState<UsuarioCreateInput>(() =>
    getInitialForm(usuario),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(usuario);

  function updateField(field: keyof UsuarioCreateInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = isEditing
        ? usuarioPatchSchema.parse({
            nome: form.nome,
            papel: form.papel,
            filialId: form.filialId,
          })
        : usuarioCreateSchema.parse(form);

      const response = await fetch(
        isEditing && usuario ? `/api/usuarios/${usuario.id}` : "/api/usuarios",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message ?? "Falha ao salvar usuario.");
      }

      const savedUsuario = await response.json();
      toast.success(
        isEditing
          ? "Usuario atualizado com sucesso."
          : "Usuario criado com sucesso.",
      );
      onSalvar(savedUsuario);
      onFechar();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: FieldErrors = {};

        for (const issue of error.issues) {
          const field = issue.path[0] as keyof UsuarioCreateInput | undefined;

          if (field && !fieldErrors[field]) {
            fieldErrors[field] = issue.message;
          }
        }

        setErrors(fieldErrors);
        toast.error("Revise os campos obrigatorios.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o usuario.",
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
          onFechar();
        }
      }}
    >
      <DialogContent className="rounded-3xl p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
            {isEditing ? "Editar usuario" : "Novo usuario"}
          </DialogTitle>
          <DialogDescription>
            Controle o acesso dos usuarios aos modulos do Villa CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <Field label="Nome" error={errors.nome}>
            <Input
              value={form.nome}
              onChange={(event) => updateField("nome", event.target.value)}
              placeholder="Nome do usuario"
              className="h-11 rounded-2xl bg-[#F4F6FA]"
            />
          </Field>

          <Field label="E-mail" error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="usuario@villaempreendimentos.com.br"
              disabled={isEditing}
              className="h-11 rounded-2xl bg-[#F4F6FA]"
            />
          </Field>

          {!isEditing && (
            <Field label="Senha inicial" error={errors.senha}>
              <Input
                type="password"
                value={form.senha}
                onChange={(event) => updateField("senha", event.target.value)}
                placeholder="Minimo de 8 caracteres"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>
          )}

          <Field label="Papel" error={errors.papel}>
            <Select
              value={form.papel}
              onValueChange={(value) => updateField("papel", value ?? "")}
            >
              <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                {papelUsuarioValues.map((papel) => (
                  <SelectItem key={papel} value={papel}>
                    {papelLabels[papel]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Filial" error={errors.filialId} className="md:col-span-2">
            <Select
              value={form.filialId ?? NONE_VALUE}
              onValueChange={(value) =>
                updateField("filialId", value ?? NONE_VALUE)
              }
            >
              <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                <SelectValue placeholder="Selecione a filial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem filial</SelectItem>
                {filiais.map((filial) => (
                  <SelectItem key={filial.id} value={filial.id}>
                    {filial.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <DialogFooter className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={onFechar}
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
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 text-[#1A2E5A]">{label}</Label>
      {children}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
