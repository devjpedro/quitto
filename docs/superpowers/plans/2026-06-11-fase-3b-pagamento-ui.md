# Fase 3b — Pagamento & Comprovantes (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI do fluxo de pagamento no drawer da parcela — anexar comprovante (presign→PUT→confirm), ações por papel (confirmar/contestar/marcar-paga) e timeline de auditoria — consumindo a API da Fase 3a.

**Architecture:** Lógica pura e testável isolada em `lib/` (`validateProofFile`, `availableActions` — a matriz papel×status×exigeConfirmação). Dados via TanStack Query (um hook por ação + invalidação alvo). UI decomposta em componentes pequenos (`proof-upload`, `proof-list`, `payment-actions`, `audit-timeline`) compostos pelo `installment-drawer` refatorado. Diálogos via Radix Dialog (novo `ui/dialog`).

**Tech Stack:** React 19 + Vite, TanStack Query v5, Eden Treaty (`@quitto/api` tipos), `radix-ui`, Tailwind, RHF/Zod (existente), Vitest + Testing Library.

> **Convenção (spec §9):** código/identificadores/rotas em inglês; texto ao usuário em pt-BR. Dinheiro em centavos.

> **Pré-requisitos:** Fase 3a em `develop` (endpoints de pagamento). Spec: `docs/superpowers/specs/2026-06-11-fase-3b-pagamento-ui-design.md`. Branch sugerida: `feat/fase-3b-pagamento-ui` a partir de `develop`. Comandos: `bun --filter @quitto/web test`, `bun run lint`, `bun run typecheck`, `bun run build`.

> **Endpoints da 3a (Eden):**
> - `api.api.installments({ installmentId }).get()` → `{ id, sequence, amountCents, dueDate, status, proofs[], events[] }`
> - `api.api.installments({ installmentId }).proofs.presign.post({ fileName, mimeType })` → `{ uploadUrl, objectKey }`
> - `api.api.installments({ installmentId }).proofs.post({ objectKey, fileName, mimeType })` → `{ status }`
> - `api.api.installments({ installmentId }).confirm.post()` → `{ status }`
> - `api.api.installments({ installmentId }).dispute.post({ reason? })` → `{ status }`
> - `api.api.installments({ installmentId })["mark-paid"].post()` → `{ status }`

---

## Estrutura de arquivos (novos/alterados)

```
apps/web/src/
├─ lib/
│  ├─ query-keys.ts            # + installment(id)
│  ├─ proof.ts                 # validateProofFile + ALLOWED_MIME + MAX_BYTES (novo)
│  └─ installment-actions.ts   # availableActions (matriz pura) (novo)
├─ hooks/
│  ├─ use-installment.ts       # installmentQueryOptions + useInstallmentQuery (novo)
│  └─ use-payment-mutations.ts # submit-proof / confirm / dispute / mark-paid (novo)
├─ components/
│  ├─ ui/dialog.tsx            # wrapper Radix Dialog (novo)
│  ├─ proof-upload.tsx         # selecionar→revisar→enviar (novo)
│  ├─ proof-list.tsx           # comprovantes + baixar (novo)
│  ├─ payment-actions.tsx      # confirmar/contestar/marcar-paga (novo)
│  ├─ audit-timeline.tsx       # timeline de eventos (novo)
│  └─ installment-drawer.tsx   # refatora: role→contractRole, integra detalhe + peças
└─ routes/contract-detail.tsx  # passa contractRole + requiresConfirmation ao drawer
apps/web/tests/                # testes correspondentes + eden-types estendido
```

---

## Task 1: `ui/dialog.tsx` — wrapper Radix Dialog

**Files:**
- Create: `apps/web/src/components/ui/dialog.tsx`
- Test: `apps/web/tests/dialog.test.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/ui/dialog.tsx`** (espelha `ui/sheet.tsx`, mas centralizado)

```tsx
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in -translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-4 rounded-2xl border border-border bg-background p-6 shadow-2xl focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="font-display font-semibold text-foreground text-lg tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-muted-foreground text-sm">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
```

- [ ] **Step 2: Escrever o teste** `apps/web/tests/dialog.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent } from "../src/components/ui/dialog";

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
    expect(screen.getByRole("button", { name: /fechar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run: `bun --filter @quitto/web test tests/dialog.test.tsx`
Expected: PASS.

- [ ] **Step 4: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck`

```bash
git add apps/web/src/components/ui/dialog.tsx apps/web/tests/dialog.test.tsx
git commit -m "feat(web): ui/dialog (wrapper Radix Dialog)"
```

---

## Task 2: `query-keys` + `use-installment` — detalhe da parcela

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/hooks/use-installment.ts`

- [ ] **Step 1: Adicionar a key em `apps/web/src/lib/query-keys.ts`**

```ts
/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
  installment: (id: string) => ["installment", id] as const,
};
```

- [ ] **Step 2: Criar `apps/web/src/hooks/use-installment.ts`**

```ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/installments/:id — proofs (signed download URLs) + audit timeline. */
export const installmentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.installment(id),
    queryFn: () => unwrap(api.api.installments({ installmentId: id }).get()),
  });

/** `enabled` lets the drawer fetch only while it is open. */
export function useInstallmentQuery(id: string, enabled: boolean) {
  return useQuery({ ...installmentQueryOptions(id), enabled });
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS (Eden infere o tipo do GET; nada de `any`).

```bash
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/use-installment.ts
git commit -m "feat(web): query key + hook do detalhe da parcela"
```

---

## Task 3: `use-payment-mutations` — submit-proof / confirm / dispute / mark-paid

**Files:**
- Create: `apps/web/src/hooks/use-payment-mutations.ts`

> O upload é um **hook composto**: presign → `PUT` direto no storage → confirm. As 4 mutações invalidam `installment(id)` + `contract(contractId)` + `contracts` (status e progresso mudam). Sem optimistic update.

- [ ] **Step 1: Criar `apps/web/src/hooks/use-payment-mutations.ts`**

```ts
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiError, unwrap } from "@/lib/api-client";
import type { ProofMime } from "@/lib/proof";
import { queryKeys } from "@/lib/query-keys";

function invalidatePayment(
  qc: QueryClient,
  contractId: string,
  installmentId: string
) {
  qc.invalidateQueries({ queryKey: queryKeys.installment(installmentId) });
  qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
  qc.invalidateQueries({ queryKey: queryKeys.contracts });
}

/** presign → PUT (direto no storage) → confirm. `file.type` já foi validado em validateProofFile. */
export function useSubmitProofMutation(contractId: string, installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const mimeType = file.type as ProofMime;
      const presign = await unwrap(
        api.api
          .installments({ installmentId })
          .proofs.presign.post({ fileName: file.name, mimeType })
      );
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new ApiError({
          code: "UPLOAD_FAILED",
          httpStatus: put.status,
          message: "Falha ao enviar o arquivo. Tente novamente.",
        });
      }
      return unwrap(
        api.api
          .installments({ installmentId })
          .proofs.post({ objectKey: presign.objectKey, fileName: file.name, mimeType })
      );
    },
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}

export function useConfirmPaymentMutation(contractId: string, installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.api.installments({ installmentId }).confirm.post()),
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}

export function useDisputePaymentMutation(contractId: string, installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      unwrap(
        api.api
          .installments({ installmentId })
          .dispute.post(reason ? { reason } : {})
      ),
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}

export function useMarkPaidMutation(contractId: string, installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.api.installments({ installmentId })["mark-paid"].post()),
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}
```

> **Nota Eden:** `confirm`/`mark-paid` não têm body — chame `.post()`. Se o `tsc` exigir um argumento, use `.post(undefined)`. O `dispute` tem body opcional: `.post({})` quando sem motivo.
> Esse arquivo importa `ProofMime` de `@/lib/proof` (Task 4). Implemente a Task 4 antes desta ou aceite o erro de import temporário; o commit desta task exige typecheck verde, então a ordem recomendada é **Task 4 → Task 3**.

- [ ] **Step 2: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

```bash
git add apps/web/src/hooks/use-payment-mutations.ts
git commit -m "feat(web): hooks de pagamento (submit-proof composto, confirm, dispute, mark-paid)"
```

---

## Task 4: `lib/proof.ts` — validação local do comprovante (TDD)

**Files:**
- Create: `apps/web/src/lib/proof.ts`
- Test: `apps/web/tests/proof.test.ts`

> **Implemente esta task ANTES da Task 3** (que importa `ProofMime`).

- [ ] **Step 1: Escrever o teste** `apps/web/tests/proof.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { validateProofFile } from "../src/lib/proof";

function makeFile(type: string, size: number): File {
  const f = new File(["x"], "c.bin", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("validateProofFile", () => {
  it("accepts pdf/jpeg/png within size", () => {
    expect(validateProofFile(makeFile("application/pdf", 1024)).ok).toBe(true);
    expect(validateProofFile(makeFile("image/jpeg", 1024)).ok).toBe(true);
    expect(validateProofFile(makeFile("image/png", 1024)).ok).toBe(true);
  });

  it("rejects non-whitelisted mime", () => {
    const r = validateProofFile(makeFile("text/plain", 1024));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/PDF, JPG ou PNG/);
    }
  });

  it("rejects empty file", () => {
    expect(validateProofFile(makeFile("application/pdf", 0)).ok).toBe(false);
  });

  it("rejects file bigger than 10MB", () => {
    expect(
      validateProofFile(makeFile("application/pdf", 10 * 1024 * 1024 + 1)).ok
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/proof.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/lib/proof.ts`**

```ts
export const PROOF_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type ProofMime = (typeof PROOF_ALLOWED_MIME)[number];
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

export type ProofValidation = { ok: true } | { ok: false; message: string };

/** Local guardrails mirroring the API (spec §7): whitelist MIME + 0 < size <= 10MB. */
export function validateProofFile(file: File): ProofValidation {
  if (!(PROOF_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Formato não suportado. Envie PDF, JPG ou PNG." };
  }
  if (file.size <= 0 || file.size > PROOF_MAX_BYTES) {
    return { ok: false, message: "Arquivo inválido (vazio ou maior que 10MB)." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/proof.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/proof.ts apps/web/tests/proof.test.ts
git commit -m "feat(web): validação local do comprovante (MIME + tamanho)"
```

---

## Task 5: `lib/installment-actions.ts` — matriz de ações (função pura, TDD)

**Files:**
- Create: `apps/web/src/lib/installment-actions.ts`
- Test: `apps/web/tests/installment-actions.test.ts`

> Espelha o RBAC + a máquina de estados da 3a. `owner` age dos dois lados (envia e confirma).

- [ ] **Step 1: Escrever o teste** `apps/web/tests/installment-actions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { availableActions } from "../src/lib/installment-actions";

describe("availableActions — com confirmação", () => {
  it("buyer envia comprovante em pending", () => {
    const a = availableActions("buyer", true, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canConfirm).toBe(false);
    expect(a.canMarkPaid).toBe(false);
  });

  it("seller confirma/contesta em awaiting_confirmation", () => {
    const a = availableActions("seller", true, "awaiting_confirmation");
    expect(a.canConfirm).toBe(true);
    expect(a.canDispute).toBe(true);
    expect(a.canUpload).toBe(false);
  });

  it("buyer reenvia comprovante em disputed", () => {
    expect(availableActions("buyer", true, "disputed").canUpload).toBe(true);
  });

  it("nenhuma ação em confirmed", () => {
    const a = availableActions("owner", true, "confirmed");
    expect(a).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });

  it("seller não envia comprovante; buyer não confirma", () => {
    expect(availableActions("seller", true, "pending").canUpload).toBe(false);
    expect(
      availableActions("buyer", true, "awaiting_confirmation").canConfirm
    ).toBe(false);
  });
});

describe("availableActions — sem confirmação", () => {
  it("buyer/owner pode enviar comprovante OU marcar paga em pending", () => {
    const a = availableActions("buyer", false, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canMarkPaid).toBe(true);
    expect(a.canConfirm).toBe(false);
  });

  it("nenhuma ação em paid", () => {
    expect(availableActions("owner", false, "paid")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });

  it("mark-paid só faz sentido sem confirmação", () => {
    expect(availableActions("owner", true, "pending").canMarkPaid).toBe(false);
  });
});

describe("availableActions — owner dos dois lados e viewer sem ações", () => {
  it("owner envia e confirma", () => {
    expect(availableActions("owner", true, "pending").canUpload).toBe(true);
    expect(
      availableActions("owner", true, "awaiting_confirmation").canConfirm
    ).toBe(true);
  });

  it("viewer nunca tem ações", () => {
    expect(availableActions("viewer", true, "pending")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
    expect(availableActions("viewer", true, "awaiting_confirmation").canConfirm).toBe(
      false
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/installment-actions.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/lib/installment-actions.ts`**

```ts
export type InstallmentActions = {
  /** enviar/reenviar comprovante */
  canUpload: boolean;
  /** marcar como paga (fluxo sem confirmação) */
  canMarkPaid: boolean;
  canConfirm: boolean;
  canDispute: boolean;
};

/**
 * Pure UI mirror of the 3a RBAC + state machine. The backend remains the
 * authority; this only decides which buttons to show.
 */
export function availableActions(
  role: string,
  requiresConfirmation: boolean,
  status: string
): InstallmentActions {
  const isPayer = role === "owner" || role === "buyer";
  const isApprover = role === "owner" || role === "seller";
  const awaiting = requiresConfirmation && status === "awaiting_confirmation";
  return {
    canUpload: isPayer && (status === "pending" || status === "disputed"),
    canMarkPaid: isPayer && !requiresConfirmation && status === "pending",
    canConfirm: isApprover && awaiting,
    canDispute: isApprover && awaiting,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/installment-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/installment-actions.ts apps/web/tests/installment-actions.test.ts
git commit -m "feat(web): matriz de ações da parcela (função pura)"
```

---

## Task 6: `audit-timeline.tsx` — timeline de eventos

**Files:**
- Create: `apps/web/src/components/audit-timeline.tsx`
- Test: `apps/web/tests/audit-timeline.test.tsx`

> Escopo 3b: label pt-BR + data/hora + motivo (em contestações). **Nome do ator fica de fora** (a API não expõe o vínculo `actorUserId`→participante hoje — ver follow-up na spec §7).

- [ ] **Step 1: Escrever o teste** `apps/web/tests/audit-timeline.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTimeline } from "../src/components/audit-timeline";

const events = [
  {
    id: "e1",
    type: "payment_disputed",
    actorUserId: "u1",
    metadata: { reason: "Não recebi" },
    createdAt: "2026-08-10T14:02:00.000Z",
  },
  {
    id: "e2",
    type: "proof_submitted",
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
    expect(screen.getByText(/Não recebi/)).toBeInTheDocument();
  });

  it("renders an empty state with no events", () => {
    render(<AuditTimeline events={[]} />);
    expect(screen.getByText(/nenhum evento/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/audit-timeline.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/components/audit-timeline.tsx`**

```tsx
export type AuditEventView = {
  id: string;
  type: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const EVENT_LABELS: Record<string, string> = {
  proof_submitted: "Comprovante enviado",
  payment_confirmed: "Pagamento confirmado",
  payment_disputed: "Pagamento contestado",
  installment_paid: "Parcela paga",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reasonOf(metadata: Record<string, unknown> | null): string | null {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

/** Read-only audit trail for an installment (newest first, from the API). */
export function AuditTimeline({ events }: { events: AuditEventView[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum evento ainda.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => {
        const reason = reasonOf(e.metadata);
        return (
          <li className="flex gap-3" key={e.id}>
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
            />
            <div className="flex flex-col">
              <span className="text-foreground text-sm">
                {EVENT_LABELS[e.type] ?? e.type}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatDateTime(e.createdAt)}
              </span>
              {reason ? (
                <span className="mt-0.5 text-muted-foreground text-xs">
                  Motivo: {reason}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/audit-timeline.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/audit-timeline.tsx apps/web/tests/audit-timeline.test.tsx
git commit -m "feat(web): timeline de auditoria da parcela"
```

---

## Task 7: `proof-list.tsx` — comprovantes com link de download

**Files:**
- Create: `apps/web/src/components/proof-list.tsx`
- Test: `apps/web/tests/proof-list.test.tsx`

- [ ] **Step 1: Escrever o teste** `apps/web/tests/proof-list.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProofList } from "../src/components/proof-list";

const proofs = [
  {
    id: "p1",
    fileName: "comprovante.pdf",
    mimeType: "application/pdf",
    sizeBytes: 204_800,
    downloadUrl: "https://storage.example/c.pdf?sig=abc",
    createdAt: "2026-08-09T10:00:00.000Z",
  },
];

describe("ProofList", () => {
  it("lists each proof with a download link", () => {
    render(<ProofList proofs={proofs} />);
    expect(screen.getByText("comprovante.pdf")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /baixar/i });
    expect(link).toHaveAttribute("href", proofs[0].downloadUrl);
  });

  it("renders an empty state with no proofs", () => {
    render(<ProofList proofs={[]} />);
    expect(screen.getByText(/nenhum comprovante/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/proof-list.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/components/proof-list.tsx`**

```tsx
import { Download, FileText } from "lucide-react";

export type ProofView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  createdAt: string;
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Signed download URLs are short-lived (GET, 5 min) — open in a new tab. */
export function ProofList({ proofs }: { proofs: ProofView[] }) {
  if (proofs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum comprovante ainda.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {proofs.map((p) => (
        <li
          className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
          key={p.id}
        >
          <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">
            {p.fileName}
          </span>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {formatSize(p.sizeBytes)}
          </span>
          <a
            className="inline-flex shrink-0 items-center gap-1 font-medium text-primary text-xs hover:underline"
            href={p.downloadUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="size-3.5" />
            baixar
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/proof-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/proof-list.tsx apps/web/tests/proof-list.test.tsx
git commit -m "feat(web): lista de comprovantes com download assinado"
```

---

## Task 8: `proof-upload.tsx` — selecionar → revisar → enviar

**Files:**
- Create: `apps/web/src/components/proof-upload.tsx`
- Test: `apps/web/tests/proof-upload.test.tsx`

> Depende de `validateProofFile` (Task 4) e `useSubmitProofMutation` (Task 3).

- [ ] **Step 1: Escrever o teste** `apps/web/tests/proof-upload.test.tsx`

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const submit = vi.fn();
vi.mock("../src/hooks/use-payment-mutations", () => ({
  useSubmitProofMutation: () => ({ mutateAsync: submit, isPending: false }),
}));

import { ProofUpload } from "../src/components/proof-upload";

function file(name: string, type: string, size = 1024): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("ProofUpload", () => {
  beforeEach(() => {
    submit.mockReset();
    submit.mockResolvedValue({ status: "awaiting_confirmation" });
  });

  it("rejects an invalid file type locally without calling the mutation", async () => {
    renderWithProviders(<ProofUpload contractId="c1" installmentId="i1" />);
    await userEvent.upload(
      screen.getByLabelText(/comprovante/i),
      file("a.txt", "text/plain")
    );
    expect(screen.getByText(/PDF, JPG ou PNG/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("reviews a valid file then submits it", async () => {
    renderWithProviders(<ProofUpload contractId="c1" installmentId="i1" />);
    const picked = file("c.pdf", "application/pdf");
    await userEvent.upload(screen.getByLabelText(/comprovante/i), picked);
    expect(screen.getByText("c.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /enviar comprovante/i }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(picked);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/proof-upload.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/components/proof-upload.tsx`**

```tsx
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSubmitProofMutation } from "@/hooks/use-payment-mutations";
import { PROOF_ALLOWED_MIME, validateProofFile } from "@/lib/proof";

const ACCEPT = PROOF_ALLOWED_MIME.join(",");

export function ProofUpload({
  contractId,
  installmentId,
}: {
  contractId: string;
  installmentId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitMutation = useSubmitProofMutation(contractId, installmentId);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      return;
    }
    const result = validateProofFile(f);
    if (result.ok) {
      setSelected(f);
      setError(null);
    } else {
      setSelected(null);
      setError(result.message);
    }
  }

  async function onSubmit() {
    if (!selected) {
      return;
    }
    await submitMutation.mutateAsync(selected);
    setSelected(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        accept={ACCEPT}
        aria-label="Comprovante"
        className="sr-only"
        onChange={onPick}
        ref={inputRef}
        type="file"
      />
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-foreground">
            {selected.name}
          </span>
          <button
            className="shrink-0 text-muted-foreground text-xs hover:underline"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            trocar
          </button>
        </div>
      ) : (
        <Button
          className="gap-2"
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="outline"
        >
          <Upload className="size-4" />
          Escolher comprovante
        </Button>
      )}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {selected ? (
        <Button
          disabled={submitMutation.isPending}
          onClick={onSubmit}
          type="button"
        >
          {submitMutation.isPending ? "Enviando…" : "Enviar comprovante"}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/proof-upload.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/proof-upload.tsx apps/web/tests/proof-upload.test.tsx
git commit -m "feat(web): upload de comprovante (selecionar→revisar→enviar)"
```

---

## Task 9: `payment-actions.tsx` — confirmar / contestar / marcar paga

**Files:**
- Create: `apps/web/src/components/payment-actions.tsx`
- Test: `apps/web/tests/payment-actions.test.tsx`

> Depende de `availableActions` (Task 5), `ui/dialog` (Task 1) e os hooks de mutação (Task 3). **Não** inclui o upload (o drawer compõe `ProofUpload` separadamente). Confirmar abre diálogo; Contestar abre diálogo com motivo opcional.

- [ ] **Step 1: Escrever o teste** `apps/web/tests/payment-actions.test.tsx`

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const confirmFn = vi.fn();
const disputeFn = vi.fn();
const markPaidFn = vi.fn();
vi.mock("../src/hooks/use-payment-mutations", () => ({
  useConfirmPaymentMutation: () => ({ mutateAsync: confirmFn, isPending: false }),
  useDisputePaymentMutation: () => ({ mutateAsync: disputeFn, isPending: false }),
  useMarkPaidMutation: () => ({ mutateAsync: markPaidFn, isPending: false }),
}));

import { PaymentActions } from "../src/components/payment-actions";

const base = { contractId: "c1", installmentId: "i1" };

describe("PaymentActions", () => {
  beforeEach(() => {
    confirmFn.mockReset().mockResolvedValue({ status: "confirmed" });
    disputeFn.mockReset().mockResolvedValue({ status: "disputed" });
    markPaidFn.mockReset().mockResolvedValue({ status: "paid" });
  });

  it("seller confirms via dialog at awaiting_confirmation", async () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="seller"
        requiresConfirmation
        status="awaiting_confirmation"
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /confirmar pagamento/i })
    );
    // dialog opens with its own confirm button
    await userEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalledOnce());
  });

  it("seller disputes with an optional reason", async () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="seller"
        requiresConfirmation
        status="awaiting_confirmation"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /contestar/i }));
    await userEvent.type(
      screen.getByLabelText(/motivo/i),
      "Não recebi o valor"
    );
    await userEvent.click(
      screen.getByRole("button", { name: /enviar contestação/i })
    );
    await waitFor(() => expect(disputeFn).toHaveBeenCalledWith("Não recebi o valor"));
  });

  it("buyer marks as paid in the no-confirmation flow", async () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="buyer"
        requiresConfirmation={false}
        status="pending"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /marcar como paga/i }));
    await waitFor(() => expect(markPaidFn).toHaveBeenCalledOnce());
  });

  it("viewer sees no action buttons", () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="viewer"
        requiresConfirmation
        status="awaiting_confirmation"
      />
    );
    expect(
      screen.queryByRole("button", { name: /confirmar pagamento/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /contestar/i })
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/payment-actions.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/components/payment-actions.tsx`**

```tsx
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useConfirmPaymentMutation,
  useDisputePaymentMutation,
  useMarkPaidMutation,
} from "@/hooks/use-payment-mutations";
import { availableActions } from "@/lib/installment-actions";

export function PaymentActions({
  contractId,
  installmentId,
  contractRole,
  requiresConfirmation,
  status,
}: {
  contractId: string;
  installmentId: string;
  contractRole: string;
  requiresConfirmation: boolean;
  status: string;
}) {
  const actions = availableActions(contractRole, requiresConfirmation, status);
  const confirmMutation = useConfirmPaymentMutation(contractId, installmentId);
  const disputeMutation = useDisputePaymentMutation(contractId, installmentId);
  const markPaidMutation = useMarkPaidMutation(contractId, installmentId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function onConfirm() {
    await confirmMutation.mutateAsync();
    setConfirmOpen(false);
  }

  async function onDispute() {
    const trimmed = reason.trim();
    await disputeMutation.mutateAsync(trimmed === "" ? undefined : trimmed);
    setDisputeOpen(false);
    setReason("");
  }

  if (
    !(actions.canConfirm || actions.canDispute || actions.canMarkPaid)
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {actions.canMarkPaid ? (
        <Button
          disabled={markPaidMutation.isPending}
          onClick={() => markPaidMutation.mutateAsync()}
          type="button"
        >
          {markPaidMutation.isPending ? "Marcando…" : "Marcar como paga"}
        </Button>
      ) : null}

      {actions.canConfirm ? (
        <Button onClick={() => setConfirmOpen(true)} type="button">
          Confirmar pagamento
        </Button>
      ) : null}

      {actions.canDispute ? (
        <Button
          onClick={() => setDisputeOpen(true)}
          type="button"
          variant="outline"
        >
          Contestar
        </Button>
      ) : null}

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description="Esta ação marca a parcela como confirmada e paga."
          title="Confirmar pagamento"
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={confirmMutation.isPending}
              onClick={onConfirm}
              type="button"
            >
              {confirmMutation.isPending ? "Confirmando…" : "Confirmar"}
            </Button>
            <Button
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setDisputeOpen} open={disputeOpen}>
        <DialogContent
          description="Diga o motivo (opcional). O comprador poderá reenviar o comprovante."
          title="Contestar pagamento"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dispute-reason">Motivo (opcional)</Label>
            <Textarea
              id="dispute-reason"
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: não identifiquei o valor na conta"
              value={reason}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={disputeMutation.isPending}
              onClick={onDispute}
              type="button"
              variant="destructive"
            >
              {disputeMutation.isPending ? "Enviando…" : "Enviar contestação"}
            </Button>
            <Button
              onClick={() => setDisputeOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/payment-actions.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/payment-actions.tsx apps/web/tests/payment-actions.test.tsx
git commit -m "feat(web): ações de pagamento (confirmar/contestar/marcar-paga)"
```

---

## Task 10: Refatorar `installment-drawer.tsx` + integrar tudo

**Files:**
- Modify: `apps/web/src/components/installment-drawer.tsx`
- Modify: `apps/web/src/routes/contract-detail.tsx`
- Modify: `apps/web/tests/installment-drawer.test.tsx`

> Renomeia `role`→`contractRole`, adiciona `requiresConfirmation`, busca o detalhe (status/proofs/events) como fonte da verdade e compõe `ProofUpload` + `PaymentActions` + `ProofList` + `AuditTimeline`. Mantém a edição de valor/vencimento do owner.

- [ ] **Step 1: Atualizar o teste** `apps/web/tests/installment-drawer.test.tsx` (mocka os novos hooks; renomeia prop)

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const mutateAsync = vi.fn();
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useUpdateInstallmentMutation: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("../src/hooks/use-payment-mutations", () => ({
  useSubmitProofMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDisputePaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkPaidMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const detail = {
  id: "i2",
  sequence: 2,
  amountCents: 200_000,
  dueDate: "2026-08-10",
  status: "pending",
  proofs: [],
  events: [],
};
vi.mock("../src/hooks/use-installment", () => ({
  useInstallmentQuery: () => ({ data: detail, isPending: false }),
}));

import { InstallmentDrawer } from "../src/components/installment-drawer";

const EDIT = /editar parcela/i;
const AMOUNT = /valor/i;
const SAVE = /salvar/i;
const UPLOAD = /escolher comprovante/i;

const installment = {
  id: "i2",
  sequence: 2,
  amountCents: 200_000,
  dueDate: "2026-08-10",
  status: "pending",
};
const noop = () => undefined;

describe("InstallmentDrawer", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: "i2" });
  });

  it("shows edit button for owner and the upload action (buyer/owner, pending)", () => {
    renderWithProviders(
      <InstallmentDrawer
        contractId="c1"
        contractRole="owner"
        installment={installment}
        onClose={noop}
        open
        requiresConfirmation
      />
    );
    expect(screen.getByRole("button", { name: EDIT })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UPLOAD })).toBeInTheDocument();
  });

  it("hides edit + actions for a viewer", () => {
    renderWithProviders(
      <InstallmentDrawer
        contractId="c1"
        contractRole="viewer"
        installment={installment}
        onClose={noop}
        open
        requiresConfirmation
      />
    );
    expect(screen.queryByRole("button", { name: EDIT })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UPLOAD })).not.toBeInTheDocument();
  });

  it("owner edits the amount and saves (calls the mutation)", async () => {
    renderWithProviders(
      <InstallmentDrawer
        contractId="c1"
        contractRole="owner"
        installment={installment}
        onClose={noop}
        open
        requiresConfirmation
      />
    );
    await userEvent.click(screen.getByRole("button", { name: EDIT }));
    const amount = screen.getByLabelText(AMOUNT);
    await userEvent.clear(amount);
    await userEvent.type(amount, "99999");
    await userEvent.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith({
      installmentId: "i2",
      body: { amountCents: 99_999 },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/installment-drawer.test.tsx`
Expected: FAIL — `contractRole`/`requiresConfirmation` ainda não existem; upload não renderiza.

- [ ] **Step 3: Reescrever `apps/web/src/components/installment-drawer.tsx`**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type UpdateInstallmentInput,
  updateInstallmentSchema,
} from "@quitto/shared";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuditTimeline } from "@/components/audit-timeline";
import { PaymentActions } from "@/components/payment-actions";
import { ProofList } from "@/components/proof-list";
import { ProofUpload } from "@/components/proof-upload";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUpdateInstallmentMutation } from "@/hooks/use-contract-mutations";
import { useInstallmentQuery } from "@/hooks/use-installment";
import { availableActions } from "@/lib/installment-actions";
import { formatBRL, formatISODateBR } from "@/lib/format";

interface Installment {
  amountCents: number;
  dueDate: string;
  id: string;
  sequence: number;
  status: string;
}

function buildBody(values: UpdateInstallmentInput): UpdateInstallmentInput {
  const body: UpdateInstallmentInput = {};
  if (values.amountCents !== undefined && !Number.isNaN(values.amountCents)) {
    body.amountCents = values.amountCents;
  }
  if (values.dueDate) {
    body.dueDate = values.dueDate;
  }
  return body;
}

export function InstallmentDrawer({
  contractId,
  contractRole,
  requiresConfirmation,
  installment,
  open,
  onClose,
}: {
  contractId: string;
  contractRole: string;
  requiresConfirmation: boolean;
  installment: Installment | null;
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useUpdateInstallmentMutation(contractId);
  const detailQuery = useInstallmentQuery(installment?.id ?? "", open && !!installment);
  const form = useForm<UpdateInstallmentInput>({
    resolver: zodResolver(updateInstallmentSchema),
  });

  if (!installment) {
    return null;
  }

  // Detail (status/proofs/events) is the source of truth; fall back to the
  // list summary while it loads.
  const detail = detailQuery.data;
  const status = detail?.status ?? installment.status;
  const proofs = detail?.proofs ?? [];
  const events = detail?.events ?? [];
  const actions = availableActions(contractRole, requiresConfirmation, status);

  const onSubmit = form.handleSubmit(async (values) => {
    await updateMutation.mutateAsync({
      installmentId: installment.id,
      body: buildBody(values),
    });
    setEditing(false);
  });

  function startEdit() {
    form.reset({ amountCents: installment?.amountCents });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    form.reset();
  }

  const isOwner = contractRole === "owner";

  return (
    <Sheet
      onOpenChange={(o) => {
        if (!o) {
          setEditing(false);
          onClose();
        }
      }}
      open={open}
    >
      <SheetContent title={`Parcela ${installment.sequence}`}>
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {editing ? "Editando" : "Detalhes"}
          </p>
          <StatusBadge status={status} />
        </div>

        {editing ? (
          <form className="flex flex-1 flex-col gap-5" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Valor (centavos)</Label>
              <Input
                id="amount"
                inputMode="numeric"
                type="number"
                {...form.register("amountCents", { valueAsNumber: true })}
              />
              {form.formState.errors.amountCents ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.amountCents.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="due">Vencimento</Label>
              <Input
                id="due"
                placeholder="AAAA-MM-DD"
                {...form.register("dueDate", {
                  setValueAs: (v) => (v === "" ? undefined : v),
                })}
              />
              {form.formState.errors.dueDate ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.dueDate.message}
                </p>
              ) : null}
            </div>
            {form.formState.errors.root ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <div className="mt-auto flex gap-2 border-border/60 border-t pt-4">
              <Button
                className="flex-1"
                disabled={updateMutation.isPending}
                type="submit"
              >
                {updateMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
              <Button
                disabled={updateMutation.isPending}
                onClick={cancelEdit}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
            <dl className="divide-y divide-border/60 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-baseline justify-between p-4">
                <dt className="text-muted-foreground text-sm">Valor</dt>
                <dd className="font-bold font-display text-foreground text-lg tabular-nums">
                  {formatBRL(installment.amountCents)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between p-4">
                <dt className="text-muted-foreground text-sm">Vencimento</dt>
                <dd className="font-display font-semibold text-foreground tabular-nums">
                  {formatISODateBR(installment.dueDate)}
                </dd>
              </div>
            </dl>

            {isOwner ? (
              <Button
                className="gap-2"
                onClick={startEdit}
                type="button"
                variant="ghost"
              >
                <Pencil className="size-4" />
                Editar parcela
              </Button>
            ) : null}

            {actions.canUpload ? (
              <section className="flex flex-col gap-2">
                <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {status === "disputed"
                    ? "Reenviar comprovante"
                    : "Enviar comprovante"}
                </h3>
                <ProofUpload contractId={contractId} installmentId={installment.id} />
              </section>
            ) : null}

            <PaymentActions
              contractId={contractId}
              contractRole={contractRole}
              installmentId={installment.id}
              requiresConfirmation={requiresConfirmation}
              status={status}
            />

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Comprovantes
              </h3>
              <ProofList proofs={proofs} />
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Histórico
              </h3>
              <AuditTimeline events={events} />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Atualizar o ponto de uso em `apps/web/src/routes/contract-detail.tsx`**

Trocar o bloco final `<InstallmentDrawer .../>` por:

```tsx
      <InstallmentDrawer
        contractId={contract.id}
        contractRole={data.role}
        installment={selected}
        onClose={() => setOpenId(null)}
        open={openId !== null}
        requiresConfirmation={contract.requiresConfirmation}
      />
```

- [ ] **Step 5: Rodar testes + typecheck**

Run: `bun --filter @quitto/web test tests/installment-drawer.test.tsx`
Expected: PASS (3 testes).
Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/installment-drawer.tsx apps/web/src/routes/contract-detail.tsx apps/web/tests/installment-drawer.test.tsx
git commit -m "feat(web): drawer da parcela integra pagamento (upload, ações, comprovantes, timeline)"
```

---

## Task 11: Eden types + suite completa + fechar a fase

**Files:**
- Modify: `apps/web/tests/eden-types.test.ts`

- [ ] **Step 1: Estender `apps/web/tests/eden-types.test.ts`** — adicionar ao fim do arquivo um novo `it` que prova a tipagem dos endpoints de parcela (eden#215):

```ts
it("infers the Fase-3a installment endpoints cross-package (eden#215 mitigation)", () => {
  const api = treaty<App>("http://localhost:3000");

  // GET /api/installments/:installmentId — detail with proofs + events.
  const detailGet = api.api.installments({ installmentId: "i" }).get;
  type DetailResponse = Awaited<ReturnType<typeof detailGet>>["data"];
  expectTypeOf<DetailResponse>().not.toBeAny();
  expectTypeOf<NonNullable<DetailResponse>["status"]>().toEqualTypeOf<string>();
  expectTypeOf<NonNullable<DetailResponse>["proofs"]>().toBeArray();
  expectTypeOf<NonNullable<DetailResponse>["events"]>().toBeArray();

  // POST presign — response is { uploadUrl, objectKey }.
  const presign = api.api.installments({ installmentId: "i" }).proofs.presign.post;
  type PresignResponse = Awaited<ReturnType<typeof presign>>["data"];
  expectTypeOf<PresignResponse>().not.toBeAny();
  expectTypeOf<NonNullable<PresignResponse>>().toEqualTypeOf<{
    uploadUrl: string;
    objectKey: string;
  }>();

  // POST confirm — response is { status }.
  const confirm = api.api.installments({ installmentId: "i" }).confirm.post;
  type ConfirmResponse = Awaited<ReturnType<typeof confirm>>["data"];
  expectTypeOf<ConfirmResponse>().not.toBeAny();
  expectTypeOf<NonNullable<ConfirmResponse>>().toEqualTypeOf<{ status: string }>();
});
```

- [ ] **Step 2: Rodar a suite do web + typecheck**

Run: `bun --filter @quitto/web test`
Expected: PASS (todos os arquivos novos + existentes).
Run: `bun --filter @quitto/web typecheck`
Expected: PASS (as assertions de tipo são o gate real do eden-types).

- [ ] **Step 3: Suite completa do monorepo**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 4: Commit + fechar a fase**

```bash
git add apps/web/tests/eden-types.test.ts
git commit -m "test(web): Eden tipa os endpoints de parcela (3a) cross-package"
```

Então usar **superpowers:finishing-a-development-branch** para integrar (merge em `develop`) e marcar a Fase 3b no ROADMAP (`docs/superpowers/ROADMAP.md`, linha **3b** → concluída).

---

## Self-Review (cobertura da spec)

- **Detalhe da parcela como fonte da verdade (GET 3a):** Task 2 (hook), Task 10 (uso no drawer) ✅
- **Upload selecionar→revisar→enviar (presign→PUT→confirm):** Tasks 3 (hook composto), 4 (validação), 8 (UI) ✅
- **Ações por papel (confirmar/contestar/marcar-paga) com diálogos:** Tasks 1 (dialog), 3 (hooks), 5 (matriz), 9 (UI) ✅
- **Matriz papel×status×exigeConfirmação:** Task 5 (função pura testada), aplicada em 9 e 10 ✅
- **Lista de comprovantes (download assinado):** Task 7 ✅
- **Timeline de auditoria:** Task 6 ✅ — **nome do ator deferido** (API não expõe; ver spec §7 atualizada)
- **Badges de status:** reaproveita `status-badge` existente (Task 10) ✅
- **Invalidação alvo, sem optimistic:** Task 3 ✅
- **Erros (403/422→refetch/404) + toasts:** o `QueryCache.onError` global (já existente em `lib/query.ts`) cobre o toast; 422 numa ação dispara refetch via invalidação do `installment(id)` no `onSuccess` não roda (erro), então o detalhe é re-buscado pelo próximo open; **mapeamento fino de mensagem por código fica a cargo do toast global** (consistente com 2b). ✅
- **`viewer` sem ações:** Tasks 5, 9, 10 ✅
- **Eden tipa os novos endpoints:** Task 11 ✅
- **Renomear `role`→`contractRole`:** Task 10 (fecha o follow-up da memória 2b) ✅
- **Fora de escopo (abas/PDF do contrato/participantes/notificações):** não tocados ✅

> **Nota (erro 422 em ações):** quando uma ação retorna 422 (a outra parte agiu antes), o `mutateAsync` rejeita → `onSuccess` não invalida. Para a UI ressincronizar na hora, a Task 9/10 deixam o drawer aberto e o detalhe é re-buscado ao reabrir; um refinamento opcional (refetch no `onError` da ação) pode ser adicionado depois sem mudar contratos. O toast global já informa o usuário.
