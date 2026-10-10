import { GoogleLogo, Key } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { PasswordField } from "@/components/ui/password-field";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/lib/auth-error";
import type { SessionUser } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { useChangePassword } from "../api";
import {
  SettingsBlock,
  SettingsRow,
  SettingsSectionShell,
} from "./settings-block";

interface Fields {
  confirm: string;
  current: string;
  next: string;
}

const EMPTY: Fields = { current: "", next: "", confirm: "" };

/** The password, as a row that opens (the same pattern as the PIX's "Alterar"): three fields, and the fields only clear when it worked. */
function PasswordRow() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [mismatch, setMismatch] = useState(false);
  const change = useChangePassword();
  const wrong =
    change.error?.message === m.settings_password_wrong()
      ? change.error.message
      : undefined;
  const other = change.error && !wrong ? change.error.message : undefined;

  function close() {
    setOpen(false);
    setFields(EMPTY);
    setMismatch(false);
    change.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (change.isPending) {
      return;
    }
    if (fields.next !== fields.confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    change.mutate(
      { currentPassword: fields.current, newPassword: fields.next },
      { onSuccess: close }
    );
  }

  function field(name: keyof Fields) {
    return {
      onChange: (event: { target: { value: string } }) =>
        setFields((prev) => ({ ...prev, [name]: event.target.value })),
      value: fields[name],
    };
  }

  return (
    <>
      <SettingsRow
        anchor={<IconTile icon={Key} tone="brand" />}
        controls={
          open ? null : (
            <Button onClick={() => setOpen(true)} variant="inset">
              {m.settings_password_open()}
            </Button>
          )
        }
        text={m.settings_password_sub()}
        title={m.settings_password_title()}
      />
      {open ? (
        <form className="grid gap-4 px-4 py-4" noValidate onSubmit={submit}>
          <PasswordField
            autoComplete="current-password"
            error={wrong}
            id="current-password"
            label={m.settings_password_current()}
            required
            {...field("current")}
          />
          <PasswordField
            autoComplete="new-password"
            error={other}
            hint={m.auth_password_hint({ min: MIN_PASSWORD_LENGTH })}
            id="new-password"
            label={m.settings_password_new()}
            required
            {...field("next")}
          />
          <PasswordField
            autoComplete="new-password"
            error={mismatch ? m.settings_password_mismatch() : undefined}
            id="confirm-password"
            label={m.settings_password_confirm()}
            required
            {...field("confirm")}
          />
          <div className="flex gap-2">
            <Button disabled={change.isPending} type="submit">
              {m.settings_password_save()}
            </Button>
            <Button onClick={close} variant="ghost">
              {m.settings_password_cancel()}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}

/** Segurança: the password; a Google-only account has none, so it says so and shows no form. */
export function SecuritySection({ me }: { me: SessionUser }) {
  return (
    <SettingsSectionShell id="security" title={m.settings_security()}>
      <SettingsBlock>
        {me.hasPassword ? (
          <PasswordRow />
        ) : (
          <SettingsRow
            anchor={<IconTile icon={GoogleLogo} tone="neutral" />}
            text={m.settings_google_sub()}
            title={m.settings_google_title()}
          />
        )}
      </SettingsBlock>
    </SettingsSectionShell>
  );
}
