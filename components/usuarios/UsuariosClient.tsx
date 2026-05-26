"use client";

import { useMemo, useState } from "react";
import {
  Edit,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import type { PapelUsuario } from "@/app/generated/prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageNavigation } from "@/components/layout/PageNavigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResetSenhaDialog } from "@/components/usuarios/ResetSenhaDialog";
import { UsuarioFormDialog } from "@/components/usuarios/UsuarioFormDialog";

type FilialOption = {
  id: string;
  nome: string;
};

export type UsuarioListItem = {
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

type UsuariosClientProps = {
  initialUsuarios: UsuarioListItem[];
  filiais: FilialOption[];
  currentUserId: string;
};

type ConfirmAction = {
  type: "deactivate" | "reactivate";
  usuario: UsuarioListItem;
} | null;

const papelLabels: Record<PapelUsuario, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  COMERCIAL: "Comercial",
  OPERACIONAL: "Operacional",
};

const papelBadgeClasses: Record<PapelUsuario, string> = {
  ADMIN: "bg-[#1A2E5A] text-white",
  GERENTE: "bg-[#E8EEFB] text-[#1A2E5A]",
  COMERCIAL: "bg-[#E9F7EF] text-[#166534]",
  OPERACIONAL: "bg-[#FFF4E5] text-[#9A5B00]",
};

function formatDate(value: string | Date | null) {
  if (!value) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function UsuariosClient({
  initialUsuarios,
  filiais,
  currentUserId,
}: UsuariosClientProps) {
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>(initialUsuarios);
  const [isLoading, setIsLoading] = useState(false);
  const [formUsuario, setFormUsuario] = useState<UsuarioListItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [resetUsuario, setResetUsuario] = useState<UsuarioListItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const metrics = useMemo(
    () => ({
      total: usuarios.length,
      ativos: usuarios.filter((usuario) => usuario.ativo).length,
      inativos: usuarios.filter((usuario) => !usuario.ativo).length,
      admins: usuarios.filter((usuario) => usuario.papel === "ADMIN").length,
    }),
    [usuarios],
  );

  async function reloadUsuarios() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/usuarios");

      if (!response.ok) {
        throw new Error("Falha ao carregar usuarios.");
      }

      setUsuarios(await response.json());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar usuarios.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSaved(usuario: UsuarioListItem) {
    setUsuarios((current) => {
      const exists = current.some((item) => item.id === usuario.id);

      if (!exists) {
        return [usuario, ...current];
      }

      return current.map((item) => (item.id === usuario.id ? usuario : item));
    });
  }

  async function executeStatusAction() {
    if (!confirmAction) {
      return;
    }

    const { usuario, type } = confirmAction;
    setActionUserId(usuario.id);

    try {
      const response = await fetch(
        type === "deactivate"
          ? `/api/usuarios/${usuario.id}`
          : `/api/usuarios/${usuario.id}/reativar`,
        {
          method: type === "deactivate" ? "DELETE" : "PATCH",
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao alterar usuario.");
      }

      const updatedUsuario = await response.json();
      handleSaved(updatedUsuario);
      toast.success(
        type === "deactivate"
          ? "Usuario desativado com sucesso."
          : "Usuario reativado com sucesso.",
      );
      setConfirmAction(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel alterar o usuario.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Usuarios" currentHref="/usuarios" />
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Administracao
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Usuarios
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Gerencie acessos, papeis, filiais e senhas dos usuarios do Villa
              CRM.
            </p>
          </div>
          <Button
            onClick={() => {
              setFormUsuario(null);
              setIsFormOpen(true);
            }}
            className="h-11 rounded-2xl bg-[#1A2E5A] px-5 text-white hover:bg-[#1E4FAB]"
          >
            <Plus className="size-4" />
            Novo usuario
          </Button>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard label="Ativos" value={metrics.ativos} />
          <MetricCard label="Inativos" value={metrics.inativos} />
          <MetricCard label="Administradores" value={metrics.admins} />
        </section>

        <Card className="mt-8 rounded-3xl border-[#D7DEEA] bg-white">
          <CardHeader className="flex flex-col gap-4 border-b border-[#D7DEEA] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
                Usuarios cadastrados
              </CardTitle>
              <CardDescription>
                Lista administrativa com status, papel e ultimo acesso.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={reloadUsuarios}
              disabled={isLoading}
              className="rounded-2xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                "Atualizar"
              )}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Usuario</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ultimo login</TableHead>
                  <TableHead className="px-6 text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-6 py-10 text-center text-[#667085]"
                    >
                      Nenhum usuario cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  usuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="px-6">
                        <div className="font-semibold text-[#1A2E5A]">
                          {usuario.nome}
                        </div>
                        <div className="text-sm text-[#667085]">
                          {usuario.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={papelBadgeClasses[usuario.papel]}>
                          {papelLabels[usuario.papel]}
                        </Badge>
                      </TableCell>
                      <TableCell>{usuario.filial?.nome ?? "Sem filial"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            usuario.ativo
                              ? "bg-[#E9F7EF] text-[#166534]"
                              : "bg-[#FEE2E2] text-[#991B1B]"
                          }
                        >
                          {usuario.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(usuario.lastLoginAt)}</TableCell>
                      <TableCell className="px-6">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setFormUsuario(usuario);
                              setIsFormOpen(true);
                            }}
                            aria-label="Editar usuario"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setResetUsuario(usuario)}
                            aria-label="Resetar senha"
                          >
                            <KeyRound className="size-4" />
                          </Button>
                          {usuario.ativo ? (
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              disabled={usuario.id === currentUserId}
                              onClick={() =>
                                setConfirmAction({
                                  type: "deactivate",
                                  usuario,
                                })
                              }
                              aria-label="Desativar usuario"
                            >
                              <UserX className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: "reactivate",
                                  usuario,
                                })
                              }
                              aria-label="Reativar usuario"
                            >
                              <UserCheck className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {isFormOpen ? (
        <UsuarioFormDialog
          aberto={isFormOpen}
          usuario={formUsuario}
          filiais={filiais}
          onFechar={() => setIsFormOpen(false)}
          onSalvar={handleSaved}
        />
      ) : null}

      {resetUsuario ? (
        <ResetSenhaDialog
          aberto={Boolean(resetUsuario)}
          usuarioId={resetUsuario.id}
          usuarioNome={resetUsuario.nome}
          onFechar={() => setResetUsuario(null)}
          onSalvar={reloadUsuarios}
        />
      ) : null}

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !actionUserId) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "deactivate"
                ? "Desativar usuario?"
                : "Reativar usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "deactivate"
                ? "O usuario nao podera acessar o CRM ate ser reativado."
                : "O usuario voltara a poder acessar o CRM com suas credenciais."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(actionUserId)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeStatusAction}
              disabled={Boolean(actionUserId)}
              className="bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
            >
              {actionUserId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <ShieldCheck className="size-5 text-[#1E4FAB]" />
        </div>
        <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
