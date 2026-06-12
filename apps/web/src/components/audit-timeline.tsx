export interface AuditEventView {
  actorUserId: string | null;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown> | null;
  type: string;
}

const EVENT_LABELS: Record<string, string> = {
  proof_submitted: "Comprovante enviado",
  payment_confirmed: "Pagamento confirmado",
  payment_disputed: "Pagamento contestado",
  installment_paid: "Parcela paga",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reasonOf(metadata: Record<string, unknown> | null): string | null {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

/** Read-only audit trail for an installment (newest first, from the API). */
export function AuditTimeline({ events }: { events: AuditEventView[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum evento ainda.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => {
        const reason = reasonOf(e.metadata);
        return (
          <li className="flex gap-3" key={e.id}>
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
            />
            <div className="flex flex-col">
              <span className="text-foreground text-sm">
                {EVENT_LABELS[e.type] ?? e.type}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatDateTime(e.createdAt)}
              </span>
              {reason ? (
                <span className="mt-0.5 text-muted-foreground text-xs">
                  Motivo: {reason}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
