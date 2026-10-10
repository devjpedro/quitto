import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => false,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
  useSearch: () => ({}),
}));
vi.mock("@/hooks/use-identity", () => ({
  useIdentity: () => ({
    id: "u1",
    name: "João Souza",
    email: "joao.souza@exemplo.com",
    image: null,
  }),
}));

import { ContractWizardPage } from "@/features/contract-wizard/components/wizard-page";
import { renderWithProviders } from "./test-utils";

/** React's client ids (_r_3_) count up across renders; they are not layout. */
const REACT_ID = /_r_[0-9a-z]+_/g;

/** The page at a width: the window and every (min-width) query answer as a browser that wide would. */
function htmlAt(width: number): string {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width") ? width >= 768 : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  const { container, unmount } = renderWithProviders(<ContractWizardPage />);
  const html = container.innerHTML.replaceAll(REACT_ID, "_id_");
  unmount();
  vi.unstubAllGlobals();
  return html;
}

describe("ContractWizardPage", () => {
  it("o mesmo HTML a 390 e a 1512: a largura é só CSS (um SSR serve a todas)", () => {
    expect(htmlAt(390)).toBe(htmlAt(1512));
  });
});
