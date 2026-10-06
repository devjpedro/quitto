import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPage } from "@/features/contracts/components/contract-page";
import { CONTRACT_SLOTS } from "@/features/contracts/components/contract-slots";
import type { ContractDetail } from "@/features/contracts/types";
import type { InstallmentDetail } from "@/features/installments/types";
import { queryKeys } from "@/lib/query-keys";
import { installmentDetail, motoDetail } from "./contract-fixtures";
import { FakeXhr } from "./fake-xhr";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

type Search = Record<string, unknown>;

const { navigate, router, served, calls } = vi.hoisted(() => {
  let search: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  return {
    navigate: vi.fn(),
    router: {
      get: () => search,
      set: (next: Record<string, unknown>) => {
        search = next;
        for (const listener of listeners) {
          listener();
        }
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    served: {
      contract: null as unknown,
      details: {} as Record<string, unknown>,
    },
    calls: {
      markPaid: vi.fn(),
      markReceived: vi.fn(),
      presign: vi.fn(),
      proofs: vi.fn(),
      saveKey: vi.fn(),
    },
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        get: () => Promise.resolve({ data: served.contract, error: null }),
        participants: ({ participantId }: { participantId: string }) => ({
          "pix-key": {
            patch: (body: unknown) => calls.saveKey(participantId, body),
          },
        }),
      }),
      installments: ({ installmentId }: { installmentId: string }) => ({
        get: () =>
          Promise.resolve({
            data: served.details[installmentId] ?? null,
            error: null,
          }),
        "mark-paid": { post: () => calls.markPaid(installmentId) },
        "mark-received": { post: () => calls.markReceived(installmentId) },
        proofs: {
          post: (body: unknown) => calls.proofs(installmentId, body),
          presign: {
            post: (body: unknown) => calls.presign(installmentId, body),
          },
        },
      }),
    },
  },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  const staticRouter = {
    state: { location: { state: {} } },
    history: { back: vi.fn() },
    subscribe: () => () => undefined,
  };
  return {
    ...(await importOriginal<typeof import("@tanstack/react-router")>()),
    Link: ({ children, className, to }: LinkProps) => (
      <a className={className} href={to}>
        {children}
      </a>
    ),
    useHydrated: () => true,
    useNavigate: () => navigate,
    useParams: () => ({ id: "c-moto" }),
    // The contract's entry, as the router keeps it (no panel pushed by the list).
    useRouter: () => staticRouter,
    useSearch: () => useSyncExternalStore(router.subscribe, router.get),
  };
});

const { toastSuccess, toastWarning } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn(), warning: toastWarning },
}));

const WA = "https://wa.me/?text=";
/** The proof the panel let go of without the user's own "Cancelar" (review I2). */
const STOPPED = [
  "Comprovante não enviado",
  {
    description:
      "O envio de pix-carlos-outubro.pdf parou porque você saiu da parcela. Abra-a de novo para enviar.",
  },
] as const;
const MB_14_2 = 14_889_779;
const BAD_TYPE = "IMG_2231.heic não é aceito. Envie PDF, JPG ou PNG.";
const TOO_LARGE =
  "extrato-setembro.pdf tem 14,2 MB, e o limite é 10 MB. Envie só a página do PIX, ou uma foto dela.";
const DROP = /Arraste o comprovante ou/;
const SAVE_KEY = /Guardar a chave/;
const KEY_FIELD = /Chave PIX/;
const MARK_PAID = "Marcar como paga sem comprovante";

const PIX_BIA = {
  copiaECola:
    "00020126430014br.gov.bcb.pix0121bia.lopes@exemplo.com5204000053039865406300.005802BR5909BIA LOPES6006BRASIL62070503***63041D3F",
  key: "bia.lopes@exemplo.com",
  keyType: "email",
  payToName: "Bia Lopes",
  source: "account" as const,
};
const PIX_HELENA = {
  copiaECola:
    "00020126470014br.gov.bcb.pix0125helena.duarte@exemplo.com52040000530398654071800.005802BR5913HELENA DUARTE6006BRASIL62070503***6304A1B2",
  key: "helena.duarte@exemplo.com",
  keyType: "email",
  payToName: "Helena Duarte",
  source: "contact" as const,
};
const PIX_JOAO = {
  copiaECola:
    "00020126440014br.gov.bcb.pix0122joao.souza@exemplo.com5204000053039865406480.005802BR5910JOAO SOUZA6006BRASIL62070503***6304E32B",
  key: "joao.souza@exemplo.com",
  keyType: "email",
  payToName: "João Souza",
  source: "account" as const,
};

/**
 * A contract João pays (the Moto's installments, another title): Floripa to
 * Bia (with an account, with confirmation), Aluguel da sala to Helena (a
 * contact, owned by João, no confirmation), Curso de inglês to Beatriz (a
 * contact with no key at all).
 */
function payerContract({
  confirmation,
  linked,
  owner,
  receiver,
  title,
}: {
  confirmation: boolean;
  linked: boolean;
  owner: boolean;
  receiver: string;
  title: string;
}): ContractDetail {
  const base = motoDetail();
  return {
    ...base,
    role: "buyer",
    isOwner: owner,
    isPayer: true,
    isApprover: false,
    contract: {
      ...base.contract,
      title,
      ownerRole: owner ? "buyer" : "seller",
      requiresConfirmation: confirmation,
    },
    participants: [
      {
        id: "p-joao",
        displayName: "João Souza",
        role: "buyer",
        linked: true,
        isOwner: owner,
        isMe: true,
        email: "joao.souza@exemplo.com",
        invite: null,
        joinedAt: "2026-06-28T19:40:00.000Z",
      },
      {
        id: "p-receiver",
        displayName: receiver,
        role: "seller",
        linked,
        isOwner: !owner,
        isMe: false,
        email: null,
        invite: null,
        joinedAt: null,
      },
    ],
  };
}

const floripa = () =>
  payerContract({
    confirmation: true,
    linked: true,
    owner: false,
    receiver: "Bia Lopes",
    title: "Viagem para Floripa",
  });
const aluguel = (owner = true) =>
  payerContract({
    confirmation: false,
    linked: false,
    owner,
    receiver: "Helena Duarte",
    title: "Aluguel da sala",
  });
const curso = (owner = true) =>
  payerContract({
    confirmation: false,
    linked: false,
    owner,
    receiver: "Beatriz Melo",
    title: "Curso de inglês",
  });

/** Installment 5 (open, due 30/10) as the payer reads it. */
function payDetail(over: Partial<InstallmentDetail> = {}): InstallmentDetail {
  return installmentDetail({
    id: "i5",
    sequence: 5,
    dueDate: "2026-10-30",
    status: "pending",
    proofs: [],
    events: [],
    receiver: {
      name: "Bia Lopes",
      hasAccount: true,
      contactParticipantId: null,
    },
    pix: PIX_BIA,
    pixMissing: false,
    ...over,
  });
}

const helenaDetail = () =>
  payDetail({
    receiver: {
      name: "Helena Duarte",
      hasAccount: false,
      contactParticipantId: "p-receiver",
    },
    pix: PIX_HELENA,
  });
const beatrizDetail = () =>
  payDetail({
    receiver: {
      name: "Beatriz Melo",
      hasAccount: false,
      contactParticipantId: "p-receiver",
    },
    pix: null,
    pixMissing: true,
  });

function renderPage({
  contract,
  detail,
  width = 1600,
}: {
  contract: ContractDetail;
  detail: InstallmentDetail;
  width?: number;
}) {
  window.innerWidth = width;
  served.contract = contract;
  served.details = { [detail.id]: detail };
  router.set({ installment: detail.id });
  const client = makeTestQueryClient();
  client.setQueryDefaults(["contract"], { gcTime: Number.POSITIVE_INFINITY });
  client.setQueryDefaults(["installment"], {
    gcTime: Number.POSITIVE_INFINITY,
  });
  client.setQueryData(queryKeys.contract("c-moto"), contract);
  client.setQueryData(queryKeys.installment(detail.id), detail);
  return renderWithProviders(<ContractPage slots={CONTRACT_SLOTS} />, {
    client,
  });
}

const panel = () => within(screen.getByTestId("installment-panel"));
const fileInput = () =>
  document.querySelector<HTMLInputElement>(
    'input[type="file"]'
  ) as HTMLInputElement;
const pdf = (name = "pix-carlos-outubro.pdf") =>
  new File(["%PDF-1.4 comprovante"], name, { type: "application/pdf" });

/** A promise the test settles by hand: the moment between the tap and the answer. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * The chooser's answer, without a pointer: the input sits outside the modal
 * sheet (the app opens it with input.click()), and a user.upload click there
 * would dismiss the sheet.
 */
function chooseFile(file: File) {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

/** Picks a good PDF and waits for its PUT to be on its way. */
async function startUpload(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(fileInput(), pdf());
  await waitFor(() => expect(FakeXhr.last?.method).toBe("PUT"));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-05T15:00:00Z"), toFake: ["Date"] });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  FakeXhr.last = undefined as unknown as FakeXhr;
  navigate.mockReset();
  navigate.mockImplementation(
    (options: { search: (prev: Search) => Search }) => {
      router.set(options.search(router.get()));
      return Promise.resolve();
    }
  );
  for (const call of Object.values(calls)) {
    call.mockReset();
  }
  calls.presign.mockResolvedValue({
    data: {
      uploadUrl: "https://s3.local/put",
      objectKey: "proofs/c-moto/i5/pix-carlos-outubro.pdf",
    },
    error: null,
  });
  toastSuccess.mockReset();
  toastWarning.mockReset();
});

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.innerWidth = 1024;
});

describe("pagar (mockup 14, P1 e P2)", () => {
  it("P1 (desktop, chave da conta): QR, 'PIX de Bia Lopes', 'chave e-mail' e a chave; Copiar copia o código e mostra 'Código copiado'", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderPage({ contract: floripa(), detail: payDetail() });
    const block = screen.getByTestId("pix-block");
    expect(
      within(block).getByRole("img", { name: "QR code do PIX de Bia Lopes" })
    ).toBeVisible();
    expect(block).toHaveTextContent(
      "PIX de Bia Lopes chave e-mailbia.lopes@exemplo.com"
    );
    expect(block).not.toHaveTextContent("guardada no contato");
    expect(within(block).getByText(PIX_BIA.copiaECola)).toBeVisible();
    // With confirmation, no "sem comprovante".
    expect(panel().queryByText("Marcar como paga sem comprovante")).toBeNull();

    await user.click(
      within(block).getByRole("button", { name: "Copiar código PIX" })
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(PIX_BIA.copiaECola)
    );
    expect(toastSuccess).toHaveBeenCalledWith("Código copiado");
  });

  it("P1 de um contato sem conta: 'guardada no contato · Editar' — o Editar só para o dono", async () => {
    const user = userEvent.setup();
    const owner = renderPage({ contract: aluguel(), detail: helenaDetail() });
    const block = screen.getByTestId("pix-block");
    expect(block).toHaveTextContent("guardada no contato · Editar");
    await user.click(within(block).getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("textbox", { name: "Chave PIX de Helena" })
    ).toHaveValue("helena.duarte@exemplo.com");
    owner.unmount();

    renderPage({ contract: aluguel(false), detail: helenaDetail() });
    const other = screen.getByTestId("pix-block");
    expect(other).toHaveTextContent("guardada no contato");
    expect(within(other).queryByRole("button", { name: "Editar" })).toBeNull();
  });

  it("P1 de um contato sem conta no celular (390): o dono vê 'Editar' (alvo de 44 px) e abre o campo; quem não é dono não vê", async () => {
    const user = userEvent.setup();
    const owner = renderPage({
      contract: aluguel(),
      detail: helenaDetail(),
      width: 390,
    });
    const block = screen.getByTestId("pix-block");
    expect(block).toHaveTextContent("guardada no contato · Editar");
    await user.click(within(block).getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("textbox", { name: "Chave PIX de Helena" })
    ).toHaveValue("helena.duarte@exemplo.com");
    owner.unmount();

    renderPage({
      contract: aluguel(false),
      detail: helenaDetail(),
      width: 390,
    });
    const other = screen.getByTestId("pix-block");
    expect(other).toHaveTextContent("guardada no contato");
    expect(within(other).queryByRole("button", { name: "Editar" })).toBeNull();
  });

  it("P1 no celular (390): 'Copiar código PIX' é o botão principal, o QR fica recolhido até 'Mostrar o QR code', e 'Enviar comprovante' está no rodapé com 'PDF, JPG ou PNG · até 10 MB'", async () => {
    const user = userEvent.setup();
    renderPage({ contract: floripa(), detail: payDetail(), width: 390 });
    const sheet = within(screen.getByRole("dialog"));
    const block = within(screen.getByTestId("pix-block"));
    expect(block.getByText("PIX de Bia Lopes")).toBeVisible();
    expect(
      block.getByRole("button", { name: "Copiar código PIX" })
    ).toHaveClass("bg-ink");
    expect(block.queryByRole("img")).toBeNull();
    await user.click(block.getByRole("button", { name: "Mostrar o QR code" }));
    expect(
      block.getByRole("img", { name: "QR code do PIX de Bia Lopes" })
    ).toBeVisible();
    // The send is pinned in the footer; the drop zone waits in the body.
    expect(
      sheet.getByRole("button", { name: "Enviar comprovante" })
    ).toBeVisible();
    expect(sheet.getByText("PDF, JPG ou PNG · até 10 MB")).toBeVisible();
    expect(screen.queryByTestId("proof-dropzone")).toBeNull();
  });

  it("P2: 'Beatriz Melo não tem chave PIX' com 'Nem no contato, nem numa conta do Quitto.'; o dono vê 'Guardar a chave de Beatriz' e 'Pedir no WhatsApp'; quem não é dono só 'Pedir no WhatsApp'", () => {
    const owner = renderPage({ contract: curso(), detail: beatrizDetail() });
    const block = within(screen.getByTestId("no-pix-block"));
    expect(block.getByText("Beatriz Melo não tem chave PIX")).toBeVisible();
    expect(
      block.getByText("Nem no contato, nem numa conta do Quitto.")
    ).toBeVisible();
    expect(
      block.getByRole("button", { name: "Guardar a chave de Beatriz" })
    ).toBeVisible();
    const ask = block.getByRole("link", { name: "Pedir no WhatsApp" });
    expect(ask).toHaveAttribute(
      "href",
      `${WA}${encodeURIComponent("Oi! Pode me mandar a sua chave PIX para eu pagar a parcela 5 de “Curso de inglês”?")}`
    );
    expect(screen.queryByTestId("pix-block")).toBeNull();
    owner.unmount();

    renderPage({ contract: curso(false), detail: beatrizDetail() });
    const other = within(screen.getByTestId("no-pix-block"));
    expect(other.queryByRole("button", { name: SAVE_KEY })).toBeNull();
    expect(
      other.getByRole("link", { name: "Pedir no WhatsApp" })
    ).toBeVisible();
  });

  it("guardar a chave: inválida mostra 'Confira a chave.' sem chamar a API; válida chama o PATCH com o id do contato", async () => {
    const user = userEvent.setup();
    calls.saveKey.mockResolvedValue({
      data: { id: "p-receiver", pixKey: "beatriz.melo@exemplo.com" },
      error: null,
    });
    renderPage({ contract: curso(), detail: beatrizDetail() });
    await user.click(
      screen.getByRole("button", { name: "Guardar a chave de Beatriz" })
    );
    const field = screen.getByRole("textbox", { name: "Chave PIX de Beatriz" });
    expect(field).toHaveFocus();
    await user.type(field, "beatriz@");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Confira a chave.")).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(calls.saveKey).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, "beatriz.melo@exemplo.com");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(calls.saveKey).toHaveBeenCalledWith("p-receiver", {
        pixKey: "beatriz.melo@exemplo.com",
      })
    );
    // Saved: the form gives the place back to the block.
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: KEY_FIELD })).toBeNull()
    );
  });
});

describe("enviar o comprovante (mockup 14, P7)", () => {
  it("arquivo .heic: erro pelo nome ('IMG_2231.heic não é aceito…'), sem presign", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage({ contract: floripa(), detail: payDetail() });
    await user.upload(
      fileInput(),
      new File(["heic"], "IMG_2231.heic", { type: "image/heic" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(BAD_TYPE);
    expect(calls.presign).not.toHaveBeenCalled();
    // The zone still takes another file.
    expect(
      within(screen.getByTestId("proof-dropzone")).getByRole("button", {
        name: DROP,
      })
    ).toBeVisible();
  });

  it("14,2 MB: erro com o tamanho ('extrato-setembro.pdf tem 14,2 MB, e o limite é 10 MB…')", async () => {
    const user = userEvent.setup();
    renderPage({ contract: floripa(), detail: payDetail() });
    const big = pdf("extrato-setembro.pdf");
    Object.defineProperty(big, "size", { value: MB_14_2 });
    await user.upload(fileInput(), big);
    expect(await screen.findByRole("alert")).toHaveTextContent(TOO_LARGE);
    expect(calls.presign).not.toHaveBeenCalled();
  });

  it("arquivo bom: presign, a barra com '212 KB de 330 KB · 64%' (role progressbar), e no fim o POST proofs e o toast", async () => {
    const user = userEvent.setup();
    calls.proofs.mockResolvedValue({
      data: {
        id: "i5",
        status: "awaiting_confirmation",
        paidAt: null,
        confirmedAt: null,
      },
      error: null,
    });
    renderPage({ contract: floripa(), detail: payDetail() });
    await startUpload(user);
    expect(calls.presign).toHaveBeenCalledWith("i5", {
      fileName: "pix-carlos-outubro.pdf",
      mimeType: "application/pdf",
    });
    expect(FakeXhr.last.url).toBe("https://s3.local/put");
    expect(FakeXhr.last.sent).toBeInstanceOf(File);
    act(() =>
      FakeXhr.last.upload.onprogress?.({
        lengthComputable: true,
        loaded: 217_088,
        total: 337_920,
      })
    );
    const progress = within(screen.getByTestId("upload-progress"));
    expect(progress.getByText("pix-carlos-outubro.pdf")).toBeVisible();
    expect(progress.getByText("212 KB de 330 KB · 64%")).toBeVisible();
    expect(
      progress.getByRole("progressbar", { name: "pix-carlos-outubro.pdf" })
    ).toHaveAttribute("aria-valuenow", "64");
    // While it goes, the Pix folds to one line.
    expect(screen.getByTestId("pix-block")).toHaveTextContent(
      "PIX de Bia Lopes"
    );
    expect(
      within(screen.getByTestId("pix-block")).getByRole("button", {
        name: "Ver QR",
      })
    ).toBeVisible();

    act(() => {
      FakeXhr.last.status = 200;
      FakeXhr.last.onload?.();
    });
    await waitFor(() =>
      expect(calls.proofs).toHaveBeenCalledWith("i5", {
        objectKey: "proofs/c-moto/i5/pix-carlos-outubro.pdf",
        fileName: "pix-carlos-outubro.pdf",
        mimeType: "application/pdf",
      })
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Comprovante enviado")
    );
    expect(screen.queryByTestId("upload-progress")).toBeNull();
  });

  it("cancelar aborta o PUT e volta a área de envio", async () => {
    const user = userEvent.setup();
    renderPage({ contract: aluguel(), detail: helenaDetail() });
    await startUpload(user);
    // Not marked paid while the proof goes (the proof would land on a paid one).
    expect(screen.queryByRole("button", { name: MARK_PAID })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancelar o envio" }));
    expect(FakeXhr.last.aborted).toBe(true);
    await waitFor(() =>
      expect(screen.queryByTestId("upload-progress")).toBeNull()
    );
    expect(
      within(screen.getByTestId("proof-dropzone")).getByRole("button", {
        name: DROP,
      })
    ).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: MARK_PAID })).toBeVisible();
    expect(calls.proofs).not.toHaveBeenCalled();
    // The user stopped it on screen: nothing more to say.
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("durante o envio, ↑ ↓ ficam desabilitadas e fechar o painel aborta o PUT, e o aviso diz que o comprovante não foi (uma vez)", async () => {
    const user = userEvent.setup();
    renderPage({ contract: floripa(), detail: payDetail() });
    await startUpload(user);
    expect(
      screen.getByRole("button", { name: "Parcela anterior" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Próxima parcela" })
    ).toBeDisabled();
    await user.keyboard("{ArrowDown}");
    expect(router.get()).toEqual({ installment: "i5" });

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(FakeXhr.last.aborted).toBe(true);
    expect(router.get()).toEqual({ installment: undefined });
    expect(calls.proofs).not.toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(toastWarning).toHaveBeenCalledWith(...STOPPED);
  });
});

describe("o envio sai do ar (M12 e bordas)", () => {
  it("a 390, a URL que tira o ?installment= durante o envio (o Voltar do navegador) aborta o PUT e avisa que o comprovante não foi", async () => {
    renderPage({ contract: floripa(), detail: payDetail(), width: 390 });
    await screen.findByRole("dialog");
    chooseFile(pdf());
    await waitFor(() => expect(FakeXhr.last?.method).toBe("PUT"));
    act(() => router.set({}));
    await waitFor(() => expect(FakeXhr.last.aborted).toBe(true));
    expect(calls.proofs).not.toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(toastWarning).toHaveBeenCalledWith(...STOPPED);
  });

  it("sair do contrato durante o envio (a página desmonta) aborta o PUT e avisa", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage({
      contract: floripa(),
      detail: payDetail(),
    });
    await startUpload(user);
    unmount();
    expect(FakeXhr.last.aborted).toBe(true);
    expect(toastWarning).toHaveBeenCalledWith(...STOPPED);
  });

  it("a 390, o alerta do arquivo recusado não volta quando o sheet fecha e a mesma parcela reabre", async () => {
    const user = userEvent.setup();
    renderPage({ contract: floripa(), detail: payDetail(), width: 390 });
    // Below lateral the sheet swaps in after hydration's media query.
    const sheet = await screen.findByRole("dialog");
    chooseFile(new File(["heic"], "IMG_2231.heic", { type: "image/heic" }));
    // Scoped to the sheet: a role query over the whole page outlasts findBy's 1 s.
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(BAD_TYPE);
    await user.click(within(sheet).getByRole("button", { name: "Fechar" }));
    expect(router.get()).toEqual({ installment: undefined });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    act(() => router.set({ installment: "i5" }));
    const reopened = await screen.findByRole("dialog");
    expect(within(reopened).queryByRole("alert")).toBeNull();
  });

  it("a 1600, trocar de parcela durante o envio aborta o PUT, não registra o comprovante e avisa", async () => {
    const user = userEvent.setup();
    renderPage({ contract: floripa(), detail: payDetail() });
    await startUpload(user);
    act(() => router.set({ installment: "i6" }));
    await waitFor(() => expect(FakeXhr.last.aborted).toBe(true));
    expect(calls.proofs).not.toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalledWith(...STOPPED);
  });

  it("o PUT recusado (403): o alerta pelo nome do arquivo e a área de envio de volta", async () => {
    const user = userEvent.setup();
    renderPage({ contract: floripa(), detail: payDetail() });
    await startUpload(user);
    act(() => {
      FakeXhr.last.status = 403;
      FakeXhr.last.onload?.();
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "pix-carlos-outubro.pdf não foi enviado. Tente de novo."
    );
    expect(screen.queryByTestId("upload-progress")).toBeNull();
    expect(
      within(screen.getByTestId("proof-dropzone")).getByRole("button", {
        name: DROP,
      })
    ).toBeVisible();
    expect(calls.proofs).not.toHaveBeenCalled();
  });

  it("o presign que falha: o mesmo alerta, sem PUT", async () => {
    const user = userEvent.setup();
    calls.presign.mockResolvedValue({
      data: null,
      error: {
        status: 500,
        value: { error: { code: "INTERNAL", message: "falhou" } },
      },
    });
    renderPage({ contract: floripa(), detail: payDetail() });
    await user.upload(fileInput(), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "pix-carlos-outubro.pdf não foi enviado. Tente de novo."
    );
    expect(FakeXhr.last).toBeUndefined();
  });

  it("depois do PUT, só falta registrar: o ✕ de cancelar sai (o POST não se aborta)", async () => {
    const user = userEvent.setup();
    const recording = deferred<unknown>();
    calls.proofs.mockReturnValue(recording.promise);
    renderPage({ contract: floripa(), detail: payDetail() });
    await startUpload(user);
    expect(
      screen.getByRole("button", { name: "Cancelar o envio" })
    ).toBeVisible();
    act(() =>
      FakeXhr.last.upload.onprogress?.({
        lengthComputable: true,
        loaded: 337_920,
        total: 337_920,
      })
    );
    expect(
      screen.queryByRole("button", { name: "Cancelar o envio" })
    ).toBeNull();
    recording.resolve({
      data: {
        id: "i5",
        status: "awaiting_confirmation",
        paidAt: null,
        confirmedAt: null,
      },
      error: null,
    });
  });

  it("fechar o painel com o PUT já feito, enquanto o comprovante é registrado: nenhum aviso de 'não enviado' (o registro termina e diz 'Comprovante enviado')", async () => {
    const user = userEvent.setup();
    const recording = deferred<unknown>();
    calls.proofs.mockReturnValue(recording.promise);
    renderPage({ contract: floripa(), detail: payDetail() });
    await startUpload(user);
    act(() => {
      FakeXhr.last.status = 200;
      FakeXhr.last.onload?.();
    });
    await waitFor(() => expect(calls.proofs).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(router.get()).toEqual({ installment: undefined });
    recording.resolve({
      data: {
        id: "i5",
        status: "awaiting_confirmation",
        paidAt: null,
        confirmedAt: null,
      },
      error: null,
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Comprovante enviado")
    );
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("o comprovante registrado já tira o P1 do painel (sem esperar o refetch)", async () => {
    const user = userEvent.setup();
    calls.proofs.mockResolvedValue({
      data: {
        id: "i5",
        status: "awaiting_confirmation",
        paidAt: null,
        confirmedAt: null,
      },
      error: null,
    });
    const { client } = renderPage({ contract: floripa(), detail: payDetail() });
    const setData = vi.spyOn(client, "setQueryData");
    await startUpload(user);
    act(() => {
      FakeXhr.last.status = 200;
      FakeXhr.last.onload?.();
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Comprovante enviado")
    );
    // The panel's own cache is patched at once (the refetch only confirms it).
    const patch = setData.mock.calls.find(
      ([key]) =>
        JSON.stringify(key) === JSON.stringify(queryKeys.installment("i5"))
    )?.[1] as (detail: unknown) => unknown;
    expect(patch(payDetail())).toMatchObject({
      status: "awaiting_confirmation",
    });
  });
});

describe("cobrar e marcar (mockup 14, P3)", () => {
  it("P3: 'Mensagem para Rafael' com a prévia da cobrança, '+ o seu PIX copia e cola', e o link do WhatsApp com a mensagem e o código (wa.me sem número)", () => {
    renderPage({
      contract: motoDetail(),
      detail: payDetail({
        id: "i3",
        sequence: 3,
        dueDate: "2026-08-30",
        receiver: {
          name: "João Souza",
          hasAccount: true,
          contactParticipantId: null,
        },
        pix: PIX_JOAO,
      }),
    });
    const block = within(screen.getByTestId("charge-block"));
    const opening =
      "Oi! A parcela 3 de 10 de “Moto do Rafa” (R$ 480,00) venceu em 30/08/2026. Consegue ver isso pra mim?";
    expect(block.getByText("Mensagem para Rafael")).toBeVisible();
    expect(block.getByText(opening)).toBeVisible();
    expect(block.getByText("+ o seu PIX copia e cola")).toBeVisible();
    const link = block.getByRole("link", { name: "Cobrar no WhatsApp" });
    expect(link).toHaveAttribute("target", "_blank");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith(WA)).toBe(true);
    const text = decodeURIComponent(href.slice(WA.length));
    expect(text).toBe(
      `${opening}\n\nPix copia e cola:\n\n${PIX_JOAO.copiaECola}`
    );
  });

  it("Recebeu por fora? Marcar como recebida marca na hora", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    calls.markReceived.mockReturnValue(answer.promise);
    renderPage({
      contract: motoDetail(),
      detail: payDetail({
        id: "i3",
        sequence: 3,
        dueDate: "2026-08-30",
        receiver: {
          name: "João Souza",
          hasAccount: true,
          contactParticipantId: null,
        },
        pix: PIX_JOAO,
      }),
    });
    expect(panel().getByText("Recebeu por fora?")).toBeVisible();
    await user.click(
      panel().getByRole("button", { name: "Marcar como recebida" })
    );
    expect(calls.markReceived).toHaveBeenCalledWith("i3");
    // Before the API answers, the panel already reads it as received.
    await waitFor(() =>
      expect(screen.queryByTestId("charge-block")).toBeNull()
    );
    answer.resolve({
      data: {
        id: "i3",
        status: "confirmed",
        paidAt: "2026-10-05T15:00:00.000Z",
        confirmedAt: "2026-10-05T15:00:00.000Z",
      },
      error: null,
    });
  });

  it("Marcar como paga sem comprovante (sem confirmação) marca na hora", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    calls.markPaid.mockReturnValue(answer.promise);
    renderPage({ contract: aluguel(), detail: helenaDetail() });
    await user.click(
      panel().getByRole("button", { name: "Marcar como paga sem comprovante" })
    );
    expect(calls.markPaid).toHaveBeenCalledWith("i5");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.queryByTestId("pix-block")).toBeNull());
    answer.resolve({
      data: {
        id: "i5",
        status: "paid",
        paidAt: "2026-10-05T15:00:00.000Z",
        confirmedAt: null,
      },
      error: null,
    });
  });

  it("duplo toque em 'Marcar como recebida' e em 'Marcar como paga sem comprovante': a API é chamada uma vez", async () => {
    const user = userEvent.setup();
    calls.markReceived.mockReturnValue(deferred<unknown>().promise);
    const received = renderPage({
      contract: motoDetail(),
      detail: payDetail({
        id: "i3",
        sequence: 3,
        dueDate: "2026-08-30",
        receiver: {
          name: "João Souza",
          hasAccount: true,
          contactParticipantId: null,
        },
        pix: PIX_JOAO,
      }),
    });
    await user.dblClick(
      panel().getByRole("button", { name: "Marcar como recebida" })
    );
    expect(calls.markReceived).toHaveBeenCalledTimes(1);
    received.unmount();

    calls.markPaid.mockReturnValue(deferred<unknown>().promise);
    renderPage({ contract: aluguel(), detail: helenaDetail() });
    await user.dblClick(
      panel().getByRole("button", { name: "Marcar como paga sem comprovante" })
    );
    expect(calls.markPaid).toHaveBeenCalledTimes(1);
  });
});
