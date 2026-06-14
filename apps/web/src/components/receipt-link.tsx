import { type InstallmentStatus, isPaidStatus } from "@quitto/shared";
import { Download } from "lucide-react";

interface ReceiptLinkProps {
  installmentId: string;
  status: InstallmentStatus;
}

/**
 * Download link for a paid installment's receipt. Plain same-origin anchor so
 * the auth cookie rides along first-party (no fetch/blob). Self-hides unless
 * the installment is paid.
 */
export function ReceiptLink({ installmentId, status }: ReceiptLinkProps) {
  if (!isPaidStatus(status)) {
    return null;
  }

  return (
    <a
      className="inline-flex items-center gap-1.5 self-start text-primary text-sm transition-colors hover:underline"
      download
      href={`/api/installments/${installmentId}/receipt.pdf`}
    >
      <Download aria-hidden="true" className="size-4" />
      Baixar recibo
    </a>
  );
}
