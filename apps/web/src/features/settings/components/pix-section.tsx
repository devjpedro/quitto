import { PixLogo, QrCode } from "@phosphor-icons/react";
import { isValidPixKey, parsePixKey } from "@quitto/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { IconTile } from "@/components/ui/icon-tile";
import { pixKeyTypeLabel } from "@/features/installments/lib/pix-key-type";
import type { SessionUser } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { useSavePixKey } from "../api";
import {
  SettingsBlock,
  SettingsRow,
  SettingsSectionShell,
} from "./settings-block";

function SavedKey({
  onChange,
  onRemove,
  pixKey,
}: {
  onChange: () => void;
  onRemove: () => void;
  pixKey: string;
}) {
  return (
    <>
      <SettingsBlock>
        <div data-testid="pix-saved">
          <SettingsRow
            anchor={<IconTile icon={PixLogo} tone="brand" />}
            controls={
              <>
                <Button onClick={onChange} variant="inset">
                  {m.settings_pix_change()}
                </Button>
                <Button
                  className="text-danger"
                  onClick={onRemove}
                  variant="ghost"
                >
                  {m.settings_pix_remove()}
                </Button>
              </>
            }
            text={pixKeyTypeLabel(parsePixKey(pixKey).type)}
            title={<span className="break-all font-mono">{pixKey}</span>}
          />
        </div>
      </SettingsBlock>
      <p className="mt-3 flex items-start gap-2 text-[13px] text-ink-muted leading-[1.45]">
        <QrCode aria-hidden="true" className="mt-px shrink-0" size={16} />
        {m.settings_pix_shown()}
      </p>
    </>
  );
}

/** Recebimento (PIX): the account's key. Saved, it is one row (tile, key, kind, Alterar, Remover); without it, the reason it matters and the field. */
export function PixSection({ me }: { me: SessionUser }) {
  const save = useSavePixKey();
  const hasKey = Boolean(me.pixKey);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(me.pixKey ?? "");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  // A synchronous lock: two Enters in a row are one request (state would arrive late).
  const sending = useRef(false);

  // Arriving without a key (the Agora's guide) goes straight to the field.
  useEffect(() => {
    if (!me.pixKey) {
      fieldRef.current?.focus();
    }
  }, [me.pixKey]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const key = value.trim();
    if (!isValidPixKey(key)) {
      setError(m.settings_pix_invalid());
      return;
    }
    sending.current = true;
    setError(null);
    save.mutate(key, {
      onSuccess: () => setEditing(false),
      onError: () => setError(m.settings_pix_error()),
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  function startEditing() {
    setValue(me.pixKey ?? "");
    setError(null);
    setEditing(true);
  }

  return (
    <SettingsSectionShell id="pix" title={m.settings_pix()}>
      {hasKey && !editing ? (
        <SavedKey
          onChange={startEditing}
          onRemove={() => setRemoving(true)}
          pixKey={me.pixKey ?? ""}
        />
      ) : (
        <form
          className="rounded-card bg-surface-card p-4"
          noValidate
          onSubmit={submit}
        >
          {hasKey ? null : (
            <p className="mb-4 flex items-center gap-3 text-ink text-sm leading-[1.4]">
              <IconTile icon={QrCode} tone="warning" />
              {m.settings_pix_missing()}
            </p>
          )}
          <TextField
            autoCapitalize="none"
            autoComplete="off"
            error={error ?? undefined}
            hint={m.settings_pix_hint()}
            id="pix-key"
            inputClassName="font-mono"
            label={m.settings_pix_label()}
            onChange={(event) => setValue(event.target.value)}
            ref={fieldRef}
            spellCheck={false}
            value={value}
          />
          <div className="mt-4 flex gap-2">
            <Button disabled={save.isPending} type="submit">
              {m.settings_pix_save()}
            </Button>
            {hasKey ? (
              <Button onClick={() => setEditing(false)} variant="ghost">
                {m.settings_pix_cancel()}
              </Button>
            ) : null}
          </div>
        </form>
      )}
      <ConfirmDialog
        cancelLabel={m.settings_pix_cancel()}
        confirmLabel={m.settings_pix_remove()}
        description={m.settings_pix_remove_text()}
        onConfirm={() =>
          save.mutate(null, {
            onSuccess: () => {
              setRemoving(false);
              setValue("");
            },
          })
        }
        onOpenChange={setRemoving}
        open={removing}
        pending={save.isPending}
        title={m.settings_pix_remove_title()}
        tone="danger"
      />
    </SettingsSectionShell>
  );
}
