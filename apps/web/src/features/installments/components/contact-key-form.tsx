import { isValidPixKey } from "@quitto/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useSaveContactKeyMutation } from "../api";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

/**
 * "Guardar a chave" and "Editar" (owner's decision 3): the key of whoever
 * receives without an account, kept on the contact. Checked here before the
 * API (which checks again); in place of the block it opened from.
 */
export function ContactKeyForm({
  initial,
  mode,
  name,
  onDone,
  participantId,
}: {
  initial: string;
  mode: PanelMode;
  /** The contact's first name. */
  name: string;
  onDone: () => void;
  participantId: string;
}) {
  const { contractId, installmentId, tryLock } = usePanel();
  const save = useSaveContactKeyMutation(contractId, installmentId);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!isValidPixKey(key)) {
      setError(m.panel_contact_key_invalid());
      field.current?.focus();
      return;
    }
    if (!tryLock()) {
      return;
    }
    save.mutate({ participantId, pixKey: key }, { onSuccess: onDone });
  };

  const tone = PANEL_TONE[mode];
  return (
    <form
      className={cn("flex flex-col rounded-card p-3.5", tone.block)}
      noValidate
      onSubmit={submit}
    >
      <TextField
        autoCapitalize="none"
        autoComplete="off"
        error={error}
        hint={m.panel_contact_key_hint()}
        id="contact-pix-key"
        label={m.panel_contact_key_label({ name })}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) {
            setError(undefined);
          }
        }}
        ref={field}
        spellCheck={false}
        value={value}
      />
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={save.isPending} type="submit">
          {m.panel_contact_key_save()}
        </Button>
        <Button className={tone.innerButton} onClick={onDone} variant="inset">
          {m.contract_cancel()}
        </Button>
      </div>
    </form>
  );
}
