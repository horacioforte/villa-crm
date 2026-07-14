"use client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmSendDialogProps = {
  aberto: boolean;
  count: number;
  sample: Array<{ nome: string; email: string; empresa: string }>;
  onFechar: () => void;
  onConfirm: () => void;
};

export default function ConfirmSendDialog({ aberto, count, sample, onFechar, onConfirm }: ConfirmSendDialogProps) {
  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">Confirmar envio</DialogTitle>
          <DialogDescription>
            Você está prestes a enviar uma campanha para <strong>{count}</strong> destinatários. Confirme para iniciar o disparo.  
            Abaixo estão os primeiros destinatários (amostra).
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          {sample.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhuma amostra disponível.</div>
          ) : (
            <ul className="text-sm list-disc list-inside">
              {sample.map((s, i) => (
                <li key={i}>{s.nome} — {s.email} — {s.empresa}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button className="bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]" onClick={onConfirm}>Confirmar e enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
