import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FilterChips } from "@/components/ui/filter-chips";

function Harness() {
  const [value, setValue] = useState("all");
  return (
    <FilterChips
      label="Filtrar parcelas"
      onValueChange={setValue}
      options={[
        { value: "all", label: "Todas" },
        { value: "pay", label: "A pagar" },
        { value: "overdue", label: "Atrasadas", count: 3 },
      ]}
      value={value}
    />
  );
}

describe("FilterChips", () => {
  it("setas trocam o escolhido; clicar no escolhido não desmarca", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const all = screen.getByRole("radio", { name: "Todas" });
    await user.click(all);
    expect(all).toBeChecked();
    await user.keyboard("{ArrowRight}");
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: "A pagar" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "A pagar" }));
    expect(screen.getByRole("radio", { name: "A pagar" })).toBeChecked();
  });

  it("a contagem entra no nome acessível", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Atrasadas 3" })).toBeVisible();
  });
});
