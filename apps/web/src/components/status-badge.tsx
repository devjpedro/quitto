import { Badge } from "@/components/ui/badge";

// Status arrives from the Eden client typed as `string`; accept string and map with fallbacks.
const LABELS: Record<string, string> = {
  pending: "pendente",
  awaiting_confirmation: "aguardando",
  confirmed: "confirmada",
  disputed: "contestada",
  paid: "paga",
};

const TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  confirmed: "success",
  pending: "warning",
  awaiting_confirmation: "warning",
  disputed: "danger",
};

const PAID = new Set(["paid", "confirmed"]);

/** Maps an installment status string (+ overdue flag) to a semantic pt-BR badge. */
export function StatusBadge({
  status,
  overdue,
}: {
  status: string;
  overdue?: boolean;
}) {
  if (overdue && !PAID.has(status)) {
    return <Badge tone="danger">atrasada</Badge>;
  }
  return (
    <Badge tone={TONES[status] ?? "neutral"}>{LABELS[status] ?? status}</Badge>
  );
}
