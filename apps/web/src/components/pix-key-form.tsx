import { isValidPixKey } from "@quitto/shared";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeQuery } from "@/hooks/use-me";
import { useUpdatePixKeyMutation } from "@/hooks/use-pix";

export function PixKeyForm() {
  const { data: me } = useMeQuery();
  const update = useUpdatePixKeyMutation();
  const [value, setValue] = useState(me?.pixKey ?? "");
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);
  // Trava síncrona de reentrada: o `disabled={isPending}` do react-query só
  // vale no próximo render, então uma rajada de Enter (auto-repeat) submete
  // várias vezes antes de desabilitar. O ref bloqueia no mesmo tick.
  const busy = useRef(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) {
      return;
    }
    setFeedback(null);
    const trimmed = value.trim();
    if (!isValidPixKey(trimmed)) {
      setFeedback({ kind: "error", message: "Chave PIX inválida." });
      return;
    }
    busy.current = true;
    try {
      await update.mutateAsync(trimmed);
      setFeedback({ kind: "ok", message: "Chave PIX salva." });
    } finally {
      busy.current = false;
    }
  }

  async function handleRemove() {
    if (busy.current) {
      return;
    }
    setFeedback(null);
    busy.current = true;
    try {
      await update.mutateAsync(null);
      setValue("");
      setFeedback({ kind: "ok", message: "Chave PIX removida." });
    } finally {
      busy.current = false;
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Sua chave aparece como QR e copia-e-cola nas parcelas dos contratos em
        que você recebe. Telefone: use o formato <code>+55</code>.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pix-key">Chave PIX</Label>
        <Input
          className="tabular-nums"
          id="pix-key"
          onChange={(e) => setValue(e.target.value)}
          placeholder="CPF, CNPJ, e-mail, +55… ou chave aleatória"
          value={value}
        />
      </div>
      {feedback && (
        <p
          className={
            feedback.kind === "ok"
              ? "text-primary text-sm"
              : "text-destructive text-sm"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {me?.pixKey ? (
          <Button
            disabled={update.isPending}
            onClick={handleRemove}
            type="button"
            variant="outline"
          >
            Remover
          </Button>
        ) : null}
        <Button disabled={update.isPending} type="submit">
          {update.isPending ? "Aguarde..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
