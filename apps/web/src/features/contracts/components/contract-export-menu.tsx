import { DownloadSimple, FilePdf, Table } from "@phosphor-icons/react";
import { Menu, MenuItem } from "@/components/ui/menu";
import { m } from "@/paraglide/messages.js";

/** Filled, no outline (DIRECAO › Contrato): the card's fill, one step down on hover. */
export const FILLED =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control bg-surface-card font-medium text-ink text-sm transition-[background-color,transform] duration-150 hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[.97] motion-reduce:active:scale-100";

const ICON = "text-ink-muted";

/** The statement as a plain same-origin download (the cookie is first-party: no fetch, no blob). */
export function ExportItems({ contractId }: { contractId: string }) {
  return (
    <>
      <MenuItem asChild>
        <a download href={`/api/contracts/${contractId}/statement.pdf`}>
          <FilePdf aria-hidden="true" className={ICON} size={18} />
          {m.contract_export_pdf()}
        </a>
      </MenuItem>
      <MenuItem asChild>
        <a download href={`/api/contracts/${contractId}/statement.csv`}>
          <Table aria-hidden="true" className={ICON} size={18} />
          {m.contract_export_csv()}
        </a>
      </MenuItem>
    </>
  );
}

/** "Exportar" (desktop): Extrato em PDF and Planilha .csv (owner's decision 10). */
export function ExportMenu({ contractId }: { contractId: string }) {
  return (
    <Menu
      label={m.contract_export()}
      trigger={
        <button className={`${FILLED} px-3.5`} type="button">
          <DownloadSimple aria-hidden="true" size={16} />
          {m.contract_export()}
        </button>
      }
    >
      <ExportItems contractId={contractId} />
    </Menu>
  );
}
