import { isValidPixKey } from "@quitto/shared";
import { type FormEvent, useState } from "react";
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const trimmed = value.trim();
    if (!isValidPixKey(trimmed)) {
      setFeedback({ kind: "error", message: "Chave PIX inválida." });
      return;
    }
    await update.mutateAsync(trimmed);
    setFeedback({ kind: "ok", message: "Chave PIX salva." });
  }

  async function handleRemove() {
    setFeedback(null);
    await update.mutateAsync(null);
    setValue("");
    setFeedback({ kind: "ok", message: "Chave PIX removida." });
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
