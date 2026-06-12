import { Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSubmitProofMutation } from "@/hooks/use-payment-mutations";
import { PROOF_ALLOWED_MIME, validateProofFile } from "@/lib/proof";

const ACCEPT = PROOF_ALLOWED_MIME.join(",");

export function ProofUpload({
  contractId,
  installmentId,
}: {
  contractId: string;
  installmentId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitMutation = useSubmitProofMutation(contractId, installmentId);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      return;
    }
    const result = validateProofFile(f);
    if (result.ok) {
      setSelected(f);
      setError(null);
    } else {
      setSelected(null);
      setError(result.message);
    }
  }

  async function onSubmit() {
    if (!selected) {
      return;
    }
    await submitMutation.mutateAsync(selected);
    setSelected(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        accept={ACCEPT}
        aria-label="Comprovante"
        className="sr-only"
        onChange={onPick}
        ref={inputRef}
        type="file"
      />
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-foreground">
            {selected.name}
          </span>
          <button
            className="shrink-0 text-muted-foreground text-xs hover:underline"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            trocar
          </button>
        </div>
      ) : (
        <Button
          className="gap-2"
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="outline"
        >
          <Upload className="size-4" />
          Escolher comprovante
        </Button>
      )}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {selected ? (
        <Button
          disabled={submitMutation.isPending}
          onClick={onSubmit}
          type="button"
        >
          {submitMutation.isPending ? "Enviando…" : "Enviar comprovante"}
        </Button>
      ) : null}
    </div>
  );
}
