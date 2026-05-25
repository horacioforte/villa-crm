import { Suspense } from "react";
import { Truck } from "lucide-react";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#F4F6FA] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-[#1A2E5A] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/60">
            Villa Empreendimentos
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-bold leading-tight">
            CRM para locacao e venda de equipamentos de concreto.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/75">
            Acompanhe clientes, obras, oportunidades e historicos comerciais em
            um ambiente criado para o fluxo da Villa.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white p-3 text-[#1A2E5A]">
              <Truck className="size-7" />
            </div>
            <div>
              <p className="font-semibold">Bombas de concreto e betoneiras</p>
              <p className="text-sm text-white/65">
                Pipeline comercial conectado a obras e equipamentos.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-[2rem] border border-[#D7DEEA] bg-white p-8 shadow-xl shadow-[#1A2E5A]/10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h2 className="mt-3 text-3xl font-bold text-[#1A2E5A]">
              Acesse sua conta
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">
              Entre com seu e-mail corporativo para continuar no painel
              comercial.
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
