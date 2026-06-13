import { isPaidStatus } from "@quitto/shared";
import { Badge } from "@/components/ui/badge";
import {
  INSTALLMENT_STATUS_LABEL,
  INSTALLMENT_STATUS_TONE,
} from "@/lib/labels";

/** Maps an installment status string (+ overdue flag) to a semantic pt-BR badge. */
export function StatusBadge({
  status,
  overdue,
}: {
  status: string;
  overdue?: boolean;
}) {
  if (overdue && !isPaidStatus(status)) {
    return <Badge tone="danger">atrasada</Badge>;
  }
  const label =
    INSTALLMENT_STATUS_LABEL[status as keyof typeof INSTALLMENT_STATUS_LABEL] ??
    status;
  const tone =
    INSTALLMENT_STATUS_TONE[status as keyof typeof INSTALLMENT_STATUS_TONE] ??
    "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}
