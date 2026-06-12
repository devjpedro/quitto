import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent } from "../src/components/ui/dialog";

const CLOSE_LABEL = /fechar/i;

describe("DialogContent", () => {
  it("renders title + description + children when open", () => {
    render(
      <Dialog open>
        <DialogContent description="Detalhes da ação" title="Confirmar">
          <p>conteúdo</p>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    expect(screen.getByText("Detalhes da ação")).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: CLOSE_LABEL })
    ).toBeInTheDocument();
  });
});
