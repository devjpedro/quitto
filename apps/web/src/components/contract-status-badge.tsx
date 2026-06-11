import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";

type Tone = ComponentProps<typeof Badge>["tone"];

const STATUS_LABELS: Record<string, string> = {
  active: "ativo",
  completed: "concluído",
  cancelled: "cancelado",
};

const STATUS_TONES: Record<string, Tone> = {
  active: "brand",
  completed: "success",
  cancelled: "neutral",
};

/** Renders the contract status (active/completed/cancelled) as a pt-BR badge. */
export function ContractStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
