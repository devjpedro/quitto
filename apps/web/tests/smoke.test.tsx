import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "./test-utils";

describe("test setup", () => {
  it("renders a component into jsdom", () => {
    renderWithProviders(<button type="button">Olá</button>);
    expect(screen.getByRole("button", { name: "Olá" })).toBeInTheDocument();
  });
});
