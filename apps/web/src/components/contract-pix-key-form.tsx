import { isValidPixKey } from "@quitto/shared";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateContractPixKeyMutation } from "@/hooks/use-contract-mutations";

export function ContractPixKeyForm({
  contractId,
  currentPixKey,
}: {
  contractId: string;
  currentPixKey: string | null;
}) {
  const update = useUpdateContractPixKeyMutation(contractId);
  const [value, setValue] = useState(currentPixKey ?? "");
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
    setFeedback({ kind: "ok", message: "Override salvo." });
  }

  async function handleRemove() {
    setFeedback(null);
    await update.mutateAsync(null);
    setValue("");
    setFeedback({ kind: "ok", message: "Override removido." });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contract-pix-key">Chave PIX deste contrato</Label>
        <Input
          className="tabular-nums"
          id="contract-pix-key"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Deixe em branco para usar a chave do perfil"
          value={value}
        />
        {currentPixKey ? null : (
          <p className="text-muted-foreground text-xs">
            Sem override — usando a chave do perfil.
          </p>
        )}
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
        {currentPixKey ? (
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
