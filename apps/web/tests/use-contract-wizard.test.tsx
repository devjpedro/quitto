import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const back = vi.fn();
let canGoBack = false;
vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => canGoBack,
  useNavigate: () => navigate,
  useRouter: () => ({ history: { back } }),
}));
vi.mock("@/hooks/use-identity", () => ({
  useIdentity: () => ({
    id: "u1",
    name: "João Souza",
    email: "joao.souza@exemplo.com",
    image: null,
  }),
}));

import { useContractWizard } from "@/features/contract-wizard/hooks/use-contract-wizard";

beforeEach(() => {
  navigate.mockReset();
  back.mockReset();
  canGoBack = false;
});

describe("useContractWizard", () => {
  it("Continuar com o passo 1 vazio: os dois erros e o passo não muda", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() => result.current.next());
    expect(result.current.step).toBe(1);
    expect(result.current.issueFor("ownerRole")?.code).toBe(
      "contract.role.required"
    );
    expect(result.current.issueFor("title")?.code).toBe(
      "contract.title.required"
    );
  });

  it("preencher limpa o erro do campo; Continuar avança; Voltar mantém os valores", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() => result.current.next());
    act(() => result.current.setValue("ownerRole", "seller"));
    expect(result.current.issueFor("ownerRole")).toBeUndefined();
    act(() => result.current.setValue("title", "Notebook da Renata"));
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    expect(result.current.preview.side).toBe("receive");
    act(() => result.current.back());
    expect(result.current.step).toBe(1);
    expect(result.current.values.title).toBe("Notebook da Renata");
  });

  it("o blur de um campo vazio e intocado não acusa; com valor, acusa", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() => result.current.blur("title"));
    expect(result.current.issueFor("title")).toBeUndefined();
    act(() => result.current.setValue("title", "a".repeat(201)));
    act(() => result.current.blur("title"));
    expect(result.current.issueFor("title")?.code).toBe(
      "contract.title.tooLong"
    );
  });

  it("goTo só volta para um passo feito", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() => result.current.goTo(3));
    expect(result.current.step).toBe(1);
  });

  it("?title= preenche enquanto o nome não foi digitado", () => {
    const { result, rerender } = renderHook(
      ({ title }: { title?: string }) =>
        useContractWizard({ titleFromSearch: title }),
      { initialProps: { title: "aluguel do apê" } }
    );
    expect(result.current.values.title).toBe("aluguel do apê");
    act(() => result.current.setValue("title", "Aluguel do apê da Lu"));
    rerender({ title: "outro" });
    expect(result.current.values.title).toBe("Aluguel do apê da Lu");
  });

  it("✕ com o formulário limpo: volta para a tela de origem (ou o Agora)", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() => result.current.close());
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
    canGoBack = true;
    const second = renderHook(() => useContractWizard());
    act(() => second.result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("✕ com o formulário sujo: pergunta; 'Continuar editando' não perde nada", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() => result.current.setValue("title", "Moto"));
    act(() => result.current.close());
    expect(result.current.discard.open).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    act(() => result.current.discard.setOpen(false));
    expect(result.current.values.title).toBe("Moto");
    act(() => result.current.close());
    act(() => result.current.discard.confirm());
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("report: um erro do servidor vai para o passo do campo", () => {
    const { result } = renderHook(() => useContractWizard());
    act(() =>
      result.current.report({
        field: "counterpartyEmail",
        code: "counterparty.email.self",
      })
    );
    expect(result.current.step).toBe(3);
    expect(result.current.issueFor("counterpartyEmail")?.code).toBe(
      "counterparty.email.self"
    );
  });
});
