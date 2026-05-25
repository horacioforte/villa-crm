"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LockKeyhole, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        senha,
        redirect: false,
      });

      if (result?.error) {
        toast.error("E-mail ou senha invalidos.");
        return;
      }

      toast.success("Login realizado com sucesso.");
      router.push(searchParams.get("callbackUrl") ?? "/");
      router.refresh();
    } catch {
      toast.error("Nao foi possivel entrar no CRM.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-[#1A2E5A]">E-mail</span>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3">
          <Mail className="size-5 text-[#1E4FAB]" />
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@villaempreendimentos.com.br"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#98A2B3]"
            required
          />
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-[#1A2E5A]">Senha</span>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3">
          <LockKeyhole className="size-5 text-[#1E4FAB]" />
          <input
            type="password"
            name="senha"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            placeholder="Digite sua senha"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#98A2B3]"
            required
          />
        </div>
      </label>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-2xl bg-[#1A2E5A] text-base font-bold text-white hover:bg-[#1E4FAB]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar no CRM"
        )}
      </Button>
    </form>
  );
}
