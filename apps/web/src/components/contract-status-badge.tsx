import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/labels";

/** Renders the contract status (active/completed/cancelled) as a pt-BR badge. */
export function ContractStatusBadge({ status }: { status: string }) {
  const label =
    CONTRACT_STATUS_LABEL[status as keyof typeof CONTRACT_STATUS_LABEL] ??
    status;
  const tone =
    CONTRACT_STATUS_TONE[status as keyof typeof CONTRACT_STATUS_TONE] ??
    "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}
