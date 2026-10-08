import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => false,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
vi.mock("@/hooks/use-identity", () => ({
  useIdentity: () => ({
    id: "u1",
    name: "João Souza",
    email: "joao.souza@exemplo.com",
    image: null,
  }),
}));

import { StepParty } from "@/features/contract-wizard/components/step-party";
import { StepReview } from "@/features/contract-wizard/components/step-review";
import { NOTEBOOK, renderWizard, toStep } from "./wizard-harness";

const OTHER = /Adicionar a outra parte/;
const SOLO = /Só eu acompanho/;

function steps(onSubmit = vi.fn()) {
  return renderWizard(
    (wizard) => (
      <>
        {wizard.step === 3 ? <StepParty wizard={wizard} /> : null}
        {wizard.step === 4 ? <StepReview wizard={wizard} /> : null}
      </>
    ),
    { onSubmit }
  );
}

describe("StepParty", () => {
  it("sem escolha, Continuar segue como 'Só eu acompanho' (o passo é opcional)", async () => {
    const user = userEvent.setup();
    const { wizard } = steps();
    toStep(wizard, 3, NOTEBOOK);
    // Without another party there is no confirmation to offer (owner's decision 10).
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.click(screen.getByRole("radio", { name: SOLO }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent("4");
  });

  it("a outra parte: nome com rosto, e-mail com a ajuda, e a confirmação de quem recebe", async () => {
    const user = userEvent.setup();
    const { wizard } = steps();
    toStep(wizard, 3, NOTEBOOK);
    await user.click(screen.getByRole("radio", { name: OTHER }));
    await user.type(
      screen.getByRole("textbox", { name: "Nome" }),
      "Renata Campos"
    );
    expect(
      screen.getByRole("textbox", { name: "E-mail para o convite opcional" })
    ).toHaveAccessibleDescription(
      "O convite sai quando o contrato for criado. Sem e-mail, só você vê o contrato."
    );
    const confirm = screen.getByRole("checkbox", {
      name: "Quero confirmar cada pagamento",
    });
    // Off until the person turns it on (owner's decision 10).
    expect(confirm).not.toBeChecked();
    expect(confirm).toHaveAccessibleDescription(
      "Quando Renata marcar uma parcela como paga, ela só conta depois que você conferir."
    );
    await user.click(confirm);
    expect(wizard().values.requiresConfirmation).toBe(true);
  });

  it("quem paga lê a confirmação do lado de lá", async () => {
    const user = userEvent.setup();
    const { wizard } = steps();
    toStep(wizard, 3, { ...NOTEBOOK, ownerRole: "buyer" });
    await user.click(screen.getByRole("radio", { name: OTHER }));
    await user.type(
      screen.getByRole("textbox", { name: "Nome" }),
      "Renata Campos"
    );
    expect(
      screen.getByRole("checkbox", { name: "Renata confirma cada pagamento" })
    ).toBeVisible();
  });

  it("quem paga, ainda sem o nome: 'A outra parte confirma…', com maiúscula", async () => {
    const user = userEvent.setup();
    const { wizard } = steps();
    toStep(wizard, 3, { ...NOTEBOOK, ownerRole: "buyer" });
    await user.click(screen.getByRole("radio", { name: OTHER }));
    expect(
      screen.getByRole("checkbox", {
        name: "A outra parte confirma cada pagamento",
      })
    ).toBeVisible();
  });

  it("o próprio e-mail: a frase no campo e o passo não avança", async () => {
    const user = userEvent.setup();
    const { wizard } = steps();
    toStep(wizard, 3, {
      ...NOTEBOOK,
      party: "other",
      counterpartyName: "Eu",
      counterpartyEmail: "Joao.Souza@exemplo.com",
    });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.getByText("Esse é o seu e-mail. Use o da outra parte.")
    ).toBeVisible();
    expect(screen.getByTestId("step")).toHaveTextContent("3");
  });
});

describe("StepReview", () => {
  const ready = {
    ...NOTEBOOK,
    party: "other" as const,
    counterpartyName: "Renata Campos",
    counterpartyEmail: "renata.campos@exemplo.com",
    requiresConfirmation: true,
  };

  it("abaixo de 1140: a lista com Editar; acima: só o convite e a confirmação", () => {
    const { wizard } = steps();
    toStep(wizard, 4, ready);
    const full = screen.getByTestId("review-full");
    expect(
      within(full).getByText("Você recebe · Notebook da Renata")
    ).toBeInTheDocument();
    expect(
      within(full).getByText("R$ 6.000,00 em 12x de R$ 500,00")
    ).toBeInTheDocument();
    expect(
      within(full).getByRole("button", { name: "Editar: Valores e datas" })
    ).toBeInTheDocument();
    const extras = screen.getByTestId("review-extras");
    expect(
      within(extras).getByText("Convite para renata.campos@exemplo.com")
    ).toBeInTheDocument();
    expect(
      within(extras).getByText("Você confirma cada pagamento")
    ).toBeInTheDocument();
    expect(within(extras).queryByText("Notebook da Renata")).toBeNull();
  });

  it("Editar volta ao passo", async () => {
    const user = userEvent.setup();
    const { wizard } = steps();
    toStep(wizard, 4, ready);
    await user.click(screen.getByRole("button", { name: "Editar: Com quem" }));
    expect(screen.getByTestId("step")).toHaveTextContent("3");
  });

  it("Criar contrato (o Continuar do passo 4) entrega os valores", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { wizard } = steps(onSubmit);
    toStep(wizard, 4, ready);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ counterpartyName: "Renata Campos" })
    );
  });
});
