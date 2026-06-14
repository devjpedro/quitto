import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  contractId: string;
}

/**
 * "Exportar" dropdown offering PDF/CSV statement downloads. Each item is a
 * plain same-origin anchor (cookie first-party, no fetch/blob).
 */
export function ExportMenu({ contractId }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted">
        <Download aria-hidden="true" className="size-4" />
        Exportar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a download href={`/api/contracts/${contractId}/statement.pdf`}>
            PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a download href={`/api/contracts/${contractId}/statement.csv`}>
            CSV
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
