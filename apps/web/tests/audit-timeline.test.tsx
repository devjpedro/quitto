import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTimeline } from "../src/components/audit-timeline";

const REASON_TEXT = /Não recebi/;
const EMPTY_TEXT = /nenhum evento/i;
const ACTOR_TEXT = /João/;
const BY_TEXT = /por /;

const events = [
  {
    id: "e1",
    type: "payment_disputed",
    actorName: null,
    actorUserId: "u1",
    metadata: { reason: "Não recebi" },
    createdAt: "2026-08-10T14:02:00.000Z",
  },
  {
    id: "e2",
    type: "proof_submitted",
    actorName: null,
    actorUserId: "u1",
    metadata: { fileName: "c.pdf" },
    createdAt: "2026-08-09T10:00:00.000Z",
  },
];

describe("AuditTimeline", () => {
  it("renders pt-BR labels and the dispute reason", () => {
    render(<AuditTimeline events={events} />);
    expect(screen.getByText("Pagamento contestado")).toBeInTheDocument();
    expect(screen.getByText("Comprovante enviado")).toBeInTheDocument();
    expect(screen.getByText(REASON_TEXT)).toBeInTheDocument();
  });

  it("renders an empty state with no events", () => {
    render(<AuditTimeline events={[]} />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it("renderiza o rótulo do evento e o nome do ator", () => {
    render(
      <AuditTimeline
        events={[
          {
            id: "e1",
            type: "proof_submitted",
            actorName: "João",
            actorUserId: "u1",
            metadata: null,
            createdAt: "2026-06-10T12:00:00.000Z",
          },
        ]}
      />
    );
    expect(screen.getByText("Comprovante enviado")).toBeInTheDocument();
    expect(screen.getByText(ACTOR_TEXT)).toBeInTheDocument();
  });

  it("omite o ator quando não há nome", () => {
    render(
      <AuditTimeline
        events={[
          {
            id: "e2",
            type: "installment_paid",
            actorName: null,
            actorUserId: null,
            metadata: null,
            createdAt: "2026-06-10T12:00:00.000Z",
          },
        ]}
      />
    );
    expect(screen.getByText("Parcela paga")).toBeInTheDocument();
    expect(screen.queryByText(BY_TEXT)).toBeNull();
  });
});
