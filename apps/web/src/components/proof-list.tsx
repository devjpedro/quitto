import { Download, FileText } from "lucide-react";

export interface ProofView {
  createdAt: string;
  downloadUrl: string;
  fileName: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Signed download URLs are short-lived (GET, 5 min) — open in a new tab. */
export function ProofList({ proofs }: { proofs: ProofView[] }) {
  if (proofs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum comprovante ainda.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {proofs.map((p) => (
        <li
          className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
          key={p.id}
        >
          <FileText
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 truncate text-foreground">
            {p.fileName}
          </span>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {formatSize(p.sizeBytes)}
          </span>
          <a
            className="inline-flex shrink-0 items-center gap-1 font-medium text-primary text-xs hover:underline"
            href={p.downloadUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="size-3.5" />
            baixar
          </a>
        </li>
      ))}
    </ul>
  );
}
