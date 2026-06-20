import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppPending } from "@/components/app-pending";

describe("AppPending", () => {
  it("mostra um skeleton de conteúdo (não tela branca, não spinner)", () => {
    const { container } = render(<AppPending />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });
});
