import { DownloadSimple, Trash } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { m } from "@/paraglide/messages.js";
import { DeleteAccountDialog } from "./delete-account-dialog";
import {
  SettingsBlock,
  SettingsRow,
  SettingsSectionShell,
} from "./settings-block";

/** Seus dados (LGPD): export the account's data, or delete it all. */
export function DataSection() {
  const [deleting, setDeleting] = useState(false);
  // The dialog is controlled (no Radix trigger), so it gives the focus back by hand.
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <SettingsSectionShell id="data" title={m.settings_data()}>
      <SettingsBlock>
        <SettingsRow
          anchor={<IconTile icon={DownloadSimple} tone="brand" />}
          controls={
            <Button asChild variant="inset">
              <a download href="/api/me/export">
                {m.settings_export_button()}
              </a>
            </Button>
          }
          text={m.settings_export_hint()}
          title={m.settings_export()}
        />
        <SettingsRow
          anchor={<IconTile icon={Trash} tone="danger" />}
          controls={
            <Button
              className="text-danger"
              onClick={() => setDeleting(true)}
              ref={trigger}
              variant="inset"
            >
              {m.settings_delete_button()}
            </Button>
          }
          text={m.settings_delete_hint()}
          title={m.settings_delete()}
        />
      </SettingsBlock>
      <DeleteAccountDialog
        onOpenChange={setDeleting}
        open={deleting}
        restoreFocus={() => trigger.current?.focus()}
      />
    </SettingsSectionShell>
  );
}
