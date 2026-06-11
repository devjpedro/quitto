import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "../src/components/status-badge";

const ATRASADA = /atrasada/i;

describe("StatusBadge", () => {
  it("renders pt-BR label for each status", () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText("paga")).toBeInTheDocument();
  });

  it("shows 'atrasada' for a pending installment past due", () => {
    render(<StatusBadge overdue status="pending" />);
    expect(screen.getByText(ATRASADA)).toBeInTheDocument();
  });

  it("shows 'pendente' for a pending installment not overdue", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("pendente")).toBeInTheDocument();
  });
});
