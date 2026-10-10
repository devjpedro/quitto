import { EnvelopeSimple } from "@phosphor-icons/react";
import { useId } from "react";
import { IconTile } from "@/components/ui/icon-tile";
import { Switch } from "@/components/ui/switch";
import type { SessionUser } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { useEmailRemindersToggle } from "../api";
import {
  SettingsBlock,
  SettingsRow,
  SettingsSectionShell,
} from "./settings-block";

/** Lembretes: one switch. Its name and its sentence are the row's, and it says its state in words too. */
export function RemindersSection({ me }: { me: SessionUser }) {
  const toggle = useEmailRemindersToggle();
  const titleId = useId();
  const hintId = useId();
  const on = me.emailRemindersOptIn;
  return (
    <SettingsSectionShell id="reminders" title={m.settings_reminders()}>
      <SettingsBlock>
        <SettingsRow
          anchor={<IconTile icon={EnvelopeSimple} tone="brand" />}
          controls={
            <>
              <span
                aria-hidden="true"
                className="text-[13px] text-ink-muted md:order-first"
              >
                {on ? m.settings_state_on() : m.settings_state_off()}
              </span>
              <Switch
                aria-describedby={hintId}
                aria-labelledby={titleId}
                checked={on}
                onCheckedChange={(checked) => toggle.mutate(checked)}
              />
            </>
          }
          text={m.settings_reminders_hint()}
          textId={hintId}
          title={m.settings_reminders_label()}
          titleId={titleId}
        />
      </SettingsBlock>
    </SettingsSectionShell>
  );
}
