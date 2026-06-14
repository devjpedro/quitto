import { DELETE_CONFIRM_PHRASE } from "@quitto/shared";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteAccountMutation } from "@/hooks/use-account";

/**
 * Zona de perigo (LGPD): exclusão definitiva da conta. O botão de confirmação
 * fica travado até o usuário digitar a frase exata (DELETE_CONFIRM_PHRASE),
 * evitando exclusão acidental. Tom destrutivo em toda a hierarquia visual.
 */
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const del = useDeleteAccountMutation();
  const matches = phrase === DELETE_CONFIRM_PHRASE;
  const canDelete = matches && !del.isPending;

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="font-display font-semibold text-foreground text-sm tracking-tight">
            Excluir conta
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Apaga permanentemente sua conta, contratos e arquivos. Esta ação não
            pode ser desfeita.
          </p>
        </div>
      </div>

      <Button
        className="mt-4"
        onClick={() => setOpen(true)}
        type="button"
        variant="destructive"
      >
        Excluir conta
      </Button>

      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPhrase("");
          }
        }}
        open={open}
      >
        <DialogContent
          description="Esta ação é irreversível. Seus contratos e arquivos serão apagados."
          title="Excluir conta"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-phrase">
              Digite&nbsp;
              <span className="font-semibold text-destructive tracking-wide">
                {DELETE_CONFIRM_PHRASE}
              </span>
              &nbsp;para confirmar
            </Label>
            <Input
              aria-invalid={phrase.length > 0 && !matches}
              autoComplete="off"
              id="confirm-phrase"
              onChange={(e) => setPhrase(e.target.value)}
              spellCheck={false}
              value={phrase}
            />
          </div>

          {del.isError ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível excluir sua conta. Tente novamente.
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!canDelete}
              onClick={() => del.mutate()}
              type="button"
              variant="destructive"
            >
              {del.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
