# Fase 5b — Notificações (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sininho com contador de não-lidas (polling), popover de notificações recentes, página `/notifications`, e deep-link que abre o drawer da parcela — consumindo os endpoints da 5a.

**Architecture:** UI fina; toda a comunicação com a API vive em `use-notifications.ts` (TanStack Query, padrão de `use-my-invites`). Rótulos/ícones por tipo em `lib/labels.ts` (de `NOTIFICATION_TYPE`, sem literais). O sininho mora na sidebar (desktop, via `Popover`) e há um item de nav "Notificações" (sidebar + bottom-nav) levando à rota cheia. O deep-link reusa o `openId` (`useState`) já existente em `contract-detail.tsx`, alimentado por um search param validado.

**Tech Stack:** React 19 + Vite, TanStack Router (code-based) + Query v5, Tailwind v4 + shadcn (`Popover`), Vitest + testing-library, Eden treaty (`@/lib/api`).

**Spec:** `docs/superpowers/specs/2026-06-13-fase-5b-notificacoes-ui-design.md`

**Git:** branch `feat/fase-5b-notificacoes-ui` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 5b no ROADMAP.

**Convenções:** código/identificadores em inglês; textos de UI em pt-BR; sem literais de tipo (use `NOTIFICATION_TYPE`); UI com identidade B2 via `frontend-design` (sem cara genérica de IA); sem comentários óbvios.

---

## Caminhos do Eden (confirmados contra a 5a)

- `api.api.notifications.get()` → lista.
- `api.api.notifications["unread-count"].get()` → `{ count }`.
- `api.api.notifications({ id }).read.post()` → marca uma.
- `api.api.notifications["read-all"].post()` → marca todas.

---

## Task 1: Query keys

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] **Step 1: Adicionar as chaves**

```ts
export const queryKeys = {
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
  installment: (id: string) => ["installment", id] as const,
  invite: (token: string) => ["invite", token] as const,
  myInvites: ["my-invites"] as const,
  notifications: ["notifications"] as const,
  notificationsUnread: ["notifications", "unread-count"] as const,
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/query-keys.ts
git commit -m "feat(web): query keys de notificações"
```

---

## Task 2: Labels e ícones por tipo

**Files:**
- Modify: `apps/web/src/lib/labels.ts`

- [ ] **Step 1: Adicionar import e mapas**

No topo, estenda o import de `@quitto/shared` para incluir `NOTIFICATION_TYPE` e `type NotificationType`. Importe ícones do `lucide-react` (já usado no projeto). Adicione ao fim do arquivo:

```ts
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  FileCheck,
  XCircle,
} from "lucide-react";

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  [NOTIFICATION_TYPE.proofSubmitted]: "Novo comprovante para confirmar",
  [NOTIFICATION_TYPE.paymentConfirmed]: "Pagamento confirmado",
  [NOTIFICATION_TYPE.paymentDisputed]: "Pagamento contestado",
  [NOTIFICATION_TYPE.installmentPaid]: "Parcela marcada como paga",
  [NOTIFICATION_TYPE.installmentDueSoon]: "Parcela vencendo em breve",
  [NOTIFICATION_TYPE.installmentOverdue]: "Parcela vencida",
};

export const NOTIFICATION_TYPE_ICON: Record<NotificationType, LucideIcon> = {
  [NOTIFICATION_TYPE.proofSubmitted]: FileCheck,
  [NOTIFICATION_TYPE.paymentConfirmed]: CheckCircle2,
  [NOTIFICATION_TYPE.paymentDisputed]: XCircle,
  [NOTIFICATION_TYPE.installmentPaid]: CheckCircle2,
  [NOTIFICATION_TYPE.installmentDueSoon]: Clock,
  [NOTIFICATION_TYPE.installmentOverdue]: AlertTriangle,
};

export const NOTIFICATION_FALLBACK_ICON: LucideIcon = BellRing;
```

(Atenção ao Biome/Ultracite: mantenha os imports no topo do arquivo, não no meio — mova o bloco `import` para junto dos outros imports; o exemplo acima junta tudo só por clareza.)

- [ ] **Step 2: Typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS (o `Record<NotificationType, …>` força cobrir todos os tipos).

- [ ] **Step 3: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/labels.ts
git commit -m "feat(web): labels e ícones por tipo de notificação"
```

---

## Task 3: `formatRelativeTimeBR`

**Files:**
- Modify: `apps/web/src/lib/format.ts`
- Test: `apps/web/tests/format.test.ts` (criar se não existir)

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/format.test.ts` (ou adicione ao existente):

```ts
import { describe, expect, it } from "vitest";
import { formatRelativeTimeBR } from "../src/lib/format";

describe("formatRelativeTimeBR", () => {
  const now = new Date("2026-06-13T12:00:00Z");

  it("formats minutes ago", () => {
    const iso = new Date("2026-06-13T11:30:00Z").toISOString();
    expect(formatRelativeTimeBR(iso, now)).toBe("há 30 minutos");
  });

  it("formats days ago", () => {
    const iso = new Date("2026-06-11T12:00:00Z").toISOString();
    expect(formatRelativeTimeBR(iso, now)).toBe("há 2 dias");
  });

  it("formats just now as seconds", () => {
    const iso = new Date("2026-06-13T11:59:55Z").toISOString();
    expect(formatRelativeTimeBR(iso, now)).toBe("há 5 segundos");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun run test -- format`
Expected: FAIL ("formatRelativeTimeBR is not exported").
(Observação: o runner é Vitest; o comando de teste do pacote é `test`. Se preferir, rode `bunx vitest run tests/format.test.ts` a partir de `apps/web`.)

- [ ] **Step 3: Implementar**

Em `apps/web/src/lib/format.ts`, adicione:

```ts
const RTF = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const REL_THRESHOLDS: { limit: number; div: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, div: 1, unit: "second" },
  { limit: 3600, div: 60, unit: "minute" },
  { limit: 86_400, div: 3600, unit: "hour" },
  { limit: 2_592_000, div: 86_400, unit: "day" },
  { limit: 31_536_000, div: 2_592_000, unit: "month" },
  { limit: Number.POSITIVE_INFINITY, div: 31_536_000, unit: "year" },
];

/** Relative time in pt-BR ("há 2 dias"). `now` is injectable for tests. */
export function formatRelativeTimeBR(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const t = REL_THRESHOLDS.find((x) => abs < x.limit) ?? REL_THRESHOLDS.at(-1);
  if (!t) {
    return "";
  }
  return RTF.format(Math.round(diffSec / t.div), t.unit);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/format.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/format.ts apps/web/tests/format.test.ts
git commit -m "feat(web): formatRelativeTimeBR"
```

---

## Task 4: Hooks `use-notifications`

**Files:**
- Create: `apps/web/src/hooks/use-notifications.ts`
- Test: `apps/web/tests/use-notifications.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/use-notifications.test.tsx`, espelhando o mock de treaty de `use-contracts.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getList = vi.fn();
const getUnread = vi.fn();
const postRead = vi.fn();
const postReadAll = vi.fn();

vi.mock("@/lib/api", () => {
  const notifications = Object.assign(
    (_params: { id: string }) => ({
      read: { post: () => postRead() },
    }),
    {
      get: () => getList(),
      "unread-count": { get: () => getUnread() },
      "read-all": { post: () => postReadAll() },
    }
  );
  return { api: { api: { notifications } } };
});

import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "../src/hooks/use-notifications";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("use-notifications", () => {
  beforeEach(() => {
    getList.mockReset();
    getUnread.mockReset();
    postRead.mockReset();
    postReadAll.mockReset();
  });

  it("unwraps the list", async () => {
    getList.mockResolvedValue({
      data: [
        {
          id: "n1",
          type: "payment_confirmed",
          contractId: "c1",
          installmentId: "i1",
          metadata: null,
          readAt: null,
          createdAt: "2026-06-13T12:00:00.000Z",
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useNotificationsQuery(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe("n1");
  });

  it("unwraps the unread count", async () => {
    getUnread.mockResolvedValue({ data: { count: 3 }, error: null });
    const { result } = renderHook(() => useUnreadCountQuery(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(3);
  });

  it("markRead invalidates list + unread", async () => {
    postRead.mockResolvedValue({ data: { ok: true }, error: null });
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkReadMutation(), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync("n1");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["notifications", "unread-count"],
    });
  });

  it("markAllRead invalidates list + unread", async () => {
    postReadAll.mockResolvedValue({ data: { ok: true }, error: null });
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkAllReadMutation(), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/use-notifications.test.tsx`
Expected: FAIL ("Cannot find module ../src/hooks/use-notifications").

- [ ] **Step 3: Implementar**

Crie `apps/web/src/hooks/use-notifications.ts`:

```ts
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const UNREAD_POLL_MS = 60_000;

export const notificationsQueryOptions = queryOptions({
  queryKey: queryKeys.notifications,
  queryFn: () => unwrap(api.api.notifications.get()),
});

export const unreadCountQueryOptions = queryOptions({
  queryKey: queryKeys.notificationsUnread,
  queryFn: () => unwrap(api.api.notifications["unread-count"].get()),
  refetchInterval: UNREAD_POLL_MS,
});

export function useNotificationsQuery() {
  return useQuery(notificationsQueryOptions);
}

export function useUnreadCountQuery() {
  return useQuery(unreadCountQueryOptions);
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.notifications });
    qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
  };
}

export function useMarkReadMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.notifications({ id }).read.post()),
    onSuccess: invalidate,
  });
}

export function useMarkAllReadMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => unwrap(api.api.notifications["read-all"].post()),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/use-notifications.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/hooks/use-notifications.ts apps/web/tests/use-notifications.test.tsx
git commit -m "feat(web): hooks de notificações (lista + unread polling + mark read)"
```

---

## Task 5: Lista reutilizável `NotificationList`

**Files:**
- Create: `apps/web/src/components/notification-list.tsx`
- Test: `apps/web/tests/notification-list.test.tsx`

A lista é o bloco visual reutilizado pelo popover e pela página. Recebe os itens + callback de "abrir" (que marca lida e navega). Use `frontend-design` para o acabamento B2.

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/notification-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationList } from "../src/components/notification-list";

const items = [
  {
    id: "n1",
    type: "installment_overdue",
    contractId: "c1",
    installmentId: "i1",
    metadata: null,
    readAt: null,
    createdAt: "2026-06-13T12:00:00.000Z",
  },
];

describe("NotificationList", () => {
  it("renders the pt-BR message for the type", () => {
    render(<NotificationList items={items} onOpen={vi.fn()} />);
    expect(screen.getByText("Parcela vencida")).toBeInTheDocument();
  });

  it("shows an empty state when there are no items", () => {
    render(<NotificationList items={[]} onOpen={vi.fn()} />);
    expect(screen.getByText(/nenhuma notificação/i)).toBeInTheDocument();
  });

  it("calls onOpen with the item when clicked", async () => {
    const onOpen = vi.fn();
    render(<NotificationList items={items} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /parcela vencida/i }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notification-list.test.tsx`
Expected: FAIL ("Cannot find module ../src/components/notification-list").

- [ ] **Step 3: Implementar**

Crie `apps/web/src/components/notification-list.tsx`. Tipe o item a partir do retorno do hook (evita redefinir o shape):

```tsx
import type { NotificationType } from "@quitto/shared";
import { formatRelativeTimeBR } from "@/lib/format";
import {
  NOTIFICATION_FALLBACK_ICON,
  NOTIFICATION_TYPE_ICON,
  NOTIFICATION_TYPE_LABEL,
} from "@/lib/labels";

export interface NotificationItem {
  id: string;
  type: string;
  contractId: string;
  installmentId: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

function messageFor(item: NotificationItem): string {
  const base =
    NOTIFICATION_TYPE_LABEL[item.type as NotificationType] ?? "Notificação";
  const reason =
    typeof item.metadata?.reason === "string" ? item.metadata.reason : null;
  return reason ? `${base}: ${reason}` : base;
}

export function NotificationList({
  items,
  onOpen,
}: {
  items: NotificationItem[];
  onOpen: (item: NotificationItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-muted-foreground text-sm">
        Nenhuma notificação por aqui.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const Icon =
          NOTIFICATION_TYPE_ICON[item.type as NotificationType] ??
          NOTIFICATION_FALLBACK_ICON;
        return (
          <li key={item.id}>
            <button
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${
                item.readAt ? "opacity-60" : ""
              }`}
              onClick={() => onOpen(item)}
              type="button"
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground text-sm">
                  {messageFor(item)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatRelativeTimeBR(item.createdAt)}
                </span>
              </span>
              {item.readAt ? null : (
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notification-list.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/notification-list.tsx apps/web/tests/notification-list.test.tsx
git commit -m "feat(web): NotificationList (mensagem + ícone + tempo relativo)"
```

---

## Task 6: Sininho `NotificationBell`

**Files:**
- Create: `apps/web/src/components/notification-bell.tsx`
- Test: `apps/web/tests/notification-bell.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/notification-bell.test.tsx`. Mocka os hooks e o `useNavigate`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const markRead = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: () => ({ data: { count: 2 } }),
  useNotificationsQuery: () => ({
    data: [
      {
        id: "n1",
        type: "installment_overdue",
        contractId: "c1",
        installmentId: "i1",
        metadata: null,
        readAt: null,
        createdAt: "2026-06-13T12:00:00.000Z",
      },
    ],
  }),
  useMarkReadMutation: () => ({ mutateAsync: markRead }),
  useMarkAllReadMutation: () => ({ mutate: vi.fn() }),
}));

import { NotificationBell } from "../src/components/notification-bell";

describe("NotificationBell", () => {
  beforeEach(() => {
    markRead.mockClear();
    navigate.mockClear();
  });

  it("shows the unread count and opens the popover", async () => {
    render(<NotificationBell />);
    expect(screen.getByText("2")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /notificações/i })
    );
    expect(screen.getByText("Parcela vencida")).toBeInTheDocument();
  });

  it("marks read and deep-links to the installment on click", async () => {
    render(<NotificationBell />);
    await userEvent.click(
      screen.getByRole("button", { name: /notificações/i })
    );
    await userEvent.click(
      screen.getByRole("button", { name: /parcela vencida/i })
    );
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: "i1" },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notification-bell.test.tsx`
Expected: FAIL ("Cannot find module ../src/components/notification-bell").

- [ ] **Step 3: Implementar**

Crie `apps/web/src/components/notification-bell.tsx`. Polir com `frontend-design` (B2):

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/hooks/use-notifications";
import {
  type NotificationItem,
  NotificationList,
} from "./notification-list";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: counter } = useUnreadCountQuery();
  const { data: items } = useNotificationsQuery();
  const markRead = useMarkReadMutation();
  const markAll = useMarkAllReadMutation();
  const count = counter?.count ?? 0;

  async function handleOpen(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      await markRead.mutateAsync(item.id);
    }
    if (item.installmentId) {
      navigate({
        to: "/contracts/$id",
        params: { id: item.contractId },
        search: { installment: item.installmentId },
      });
      return;
    }
    navigate({ to: "/contracts/$id", params: { id: item.contractId } });
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={`Notificações${count > 0 ? `, ${count} não lidas` : ""}`}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell aria-hidden="true" className="size-4" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="-right-0.5 -top-0.5 absolute flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-semibold text-[10px] text-primary-foreground leading-4"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-border border-b px-4 py-2.5">
          <span className="font-semibold text-sm">Notificações</span>
          {count > 0 ? (
            <button
              className="text-muted-foreground text-xs hover:text-foreground"
              onClick={() => markAll.mutate()}
              type="button"
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <NotificationList items={items ?? []} onOpen={handleOpen} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notification-bell.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/notification-bell.tsx apps/web/tests/notification-bell.test.tsx
git commit -m "feat(web): NotificationBell (popover + badge + deep-link)"
```

---

## Task 7: Rota `/notifications` + deep-link na rota de detalhe

**Files:**
- Create: `apps/web/src/routes/notifications.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/tests/notifications-page.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/notifications-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const markRead = vi.fn().mockResolvedValue(undefined);
const markAll = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/use-notifications", () => ({
  useNotificationsQuery: () => ({
    data: [
      {
        id: "n1",
        type: "payment_confirmed",
        contractId: "c1",
        installmentId: "i1",
        metadata: null,
        readAt: null,
        createdAt: "2026-06-13T12:00:00.000Z",
      },
    ],
    isPending: false,
  }),
  useMarkReadMutation: () => ({ mutateAsync: markRead }),
  useMarkAllReadMutation: () => ({ mutate: markAll }),
}));

import { NotificationsPage } from "../src/routes/notifications";

describe("NotificationsPage", () => {
  it("lists notifications and marks all as read", async () => {
    render(<NotificationsPage />);
    expect(screen.getByText("Pagamento confirmado")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /marcar todas como lidas/i })
    );
    expect(markAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notifications-page.test.tsx`
Expected: FAIL ("Cannot find module ../src/routes/notifications").

- [ ] **Step 3: Implementar a página**

Crie `apps/web/src/routes/notifications.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import {
  type NotificationItem,
  NotificationList,
} from "@/components/notification-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
} from "@/hooks/use-notifications";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isPending } = useNotificationsQuery();
  const markRead = useMarkReadMutation();
  const markAll = useMarkAllReadMutation();

  async function handleOpen(item: NotificationItem) {
    if (!item.readAt) {
      await markRead.mutateAsync(item.id);
    }
    navigate({
      to: "/contracts/$id",
      params: { id: item.contractId },
      search: item.installmentId
        ? { installment: item.installmentId }
        : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-bold font-display text-2xl">Notificações</h1>
        <button
          className="text-muted-foreground text-sm hover:text-foreground"
          onClick={() => markAll.mutate()}
          type="button"
        >
          Marcar todas como lidas
        </button>
      </div>
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <NotificationList items={data ?? []} onOpen={handleOpen} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Registrar a rota e o deep-link no `router.tsx`**

Em `apps/web/src/router.tsx`:

1. importe `NotificationsPage`: `import { NotificationsPage } from "./routes/notifications";`
2. adicione `validateSearch` à `contractDetailRoute`:

```ts
const contractDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts/$id",
  validateSearch: (search: Record<string, unknown>) => ({
    installment:
      typeof search.installment === "string" ? search.installment : undefined,
  }),
  loader: ({ params }) =>
    queryClient.ensureQueryData(contractQueryOptions(params.id)),
  component: ContractDetailPage,
});
```

3. crie a rota da página:

```ts
const notificationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/notifications",
  loader: () => queryClient.ensureQueryData(notificationsQueryOptions),
  component: NotificationsPage,
});
```

(importe `notificationsQueryOptions` de `./hooks/use-notifications`.)

4. adicione `notificationsRoute` em `protectedRoute.addChildren([...])`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notifications-page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/notifications.tsx apps/web/src/router.tsx apps/web/tests/notifications-page.test.tsx
git commit -m "feat(web): rota /notifications + search param de deep-link"
```

---

## Task 8: Deep-link abre o drawer em `contract-detail`

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx`
- Test: `apps/web/tests/contract-detail-deeplink.test.tsx`

O search param `installment` inicializa o `openId`. Reusa o `useState` já existente; sincroniza quando o param muda.

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/contract-detail-deeplink.test.tsx`. Mocka o hook de contrato, o router e **stuba os drawers** (isola o wiring do `openId` sem puxar a cadeia de queries do drawer real):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "c1" }),
  useSearch: () => ({ installment: "i1" }),
}));

vi.mock("@/components/installment-drawer", () => ({
  InstallmentDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="installment-drawer" /> : null,
}));
vi.mock("@/components/participants-drawer", () => ({
  ParticipantsDrawer: () => null,
}));

vi.mock("@/hooks/use-contracts", () => ({
  useContractQuery: () => ({
    isPending: false,
    data: {
      contract: {
        title: "Contrato",
        status: "active",
        ownerRole: "buyer",
        requiresConfirmation: false,
      },
      isOwner: true,
      progress: { overdueCount: 0, paidCount: 0, totalCount: 1, percent: 0 },
      participants: [],
      installments: [
        {
          id: "i1",
          sequence: 1,
          amountCents: 1000,
          dueDate: "2026-07-10",
          status: "pending",
        },
      ],
    },
  }),
}));

import { ContractDetailPage } from "../src/routes/contract-detail";

describe("contract-detail deep-link", () => {
  it("opens the installment drawer when ?installment matches", () => {
    render(<ContractDetailPage />);
    expect(screen.getByTestId("installment-drawer")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-detail-deeplink.test.tsx`
Expected: FAIL (drawer fechado — `openId` começa `null`).

- [ ] **Step 3: Implementar**

Em `apps/web/src/routes/contract-detail.tsx`:

1. importe `useSearch` e `useEffect`:

```ts
import { useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
```

2. logo após o `useParams`, leia o search e sincronize o `openId`:

```ts
const { installment } = useSearch({ from: "/protected/contracts/$id" });
const [openId, setOpenId] = useState<string | null>(installment ?? null);

useEffect(() => {
  if (installment) {
    setOpenId(installment);
  }
}, [installment]);
```

(Remova a linha antiga `const [openId, setOpenId] = useState<string | null>(null);`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-detail-deeplink.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/contract-detail.tsx apps/web/tests/contract-detail-deeplink.test.tsx
git commit -m "feat(web): deep-link abre o drawer da parcela"
```

---

## Task 9: Sininho + item "Notificações" na shell

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Test: `apps/web/tests/app-sidebar.test.tsx` (estender)

- [ ] **Step 1: Estender o teste**

O `app-sidebar.test.tsx` atual mocka `@tanstack/react-router` (só `Link`) e `@/lib/auth-client`. O `AppSidebar` passará a importar `NotificationBell` (que usa hooks de query) e `useUnreadCountQuery` — adicione os dois mocks no topo, junto dos existentes:

```tsx
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="bell" />,
}));
vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: () => ({ data: { count: 0 } }),
}));
```

E adicione o caso (mesmo padrão `render(<AppSidebar />)` dos existentes):

```tsx
it("renders the Notificações nav item", () => {
  render(<AppSidebar />);
  expect(screen.getAllByText("Notificações").length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/app-sidebar.test.tsx`
Expected: FAIL (sem item "Notificações").

- [ ] **Step 3: Implementar**

Em `apps/web/src/components/app-sidebar.tsx`:

1. importe o sininho e o ícone, e o hook de contagem:

```ts
import { Bell, FileText, LayoutDashboard, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useUnreadCountQuery } from "@/hooks/use-notifications";
```

2. adicione "Notificações" ao `NAV`:

```ts
const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/notifications", label: "Notificações", icon: Bell },
] as const;
```

3. no topo do componente, leia a contagem:

```ts
const { data: counter } = useUnreadCountQuery();
const unread = counter?.count ?? 0;
```

4. no cabeçalho da sidebar desktop (o `div` com o logo "◷ Quitto"), coloque o sininho à direita — transforme o container num flex com `justify-between` e adicione `<NotificationBell />` após o `<span>` do logo.

5. no item de nav, quando for `/notifications` e `unread > 0`, renderize um badge ao lado do label. Dentro do `.map`, após `{item.label}`:

```tsx
{item.to === "/notifications" && unread > 0 ? (
  <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground leading-5">
    {unread > 9 ? "9+" : unread}
  </span>
) : null}
```

(Aplique o mesmo badge na versão bottom-nav do item, posicionado sobre o ícone — ex.: um `<span absolute>` no `Link` do mobile quando `item.to === "/notifications" && unread > 0`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/app-sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/app-sidebar.tsx apps/web/tests/app-sidebar.test.tsx
git commit -m "feat(web): sininho na sidebar + item Notificações com badge"
```

---

## Task 10: Verificação final + merge + roadmap

- [ ] **Step 1: Suíte completa do web**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: tudo verde (incluindo os novos arquivos).

- [ ] **Step 2: Typecheck + lint do monorepo**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes.

- [ ] **Step 3: Smoke manual (dev)**

Suba o stack (`bun run dev` na raiz, com a API apontando para o Postgres) e confira: o sininho mostra o contador; clicar numa notificação marca como lida e abre o drawer da parcela certa; a rota `/notifications` lista tudo e "marcar todas" zera o contador; a bottom-nav mostra o item no mobile (DevTools responsivo).

- [ ] **Step 4: Marcar a 5b no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, troque a célula de plano da linha **5b** de `a escrever` para:
`` `plans/2026-06-13-fase-5b-notificacoes-ui.md` ✅ **concluído** (merge em `develop`; suite verde — sininho com polling, popover, rota /notifications, deep-link abrindo o drawer, badge na sidebar/bottom-nav) ``

- [ ] **Step 5: Commit do roadmap**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 5b concluída no roadmap"
```

- [ ] **Step 6: Merge em `develop`**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git checkout develop
git merge --no-ff feat/fase-5b-notificacoes-ui -m "Merge: Fase 5b — notificações (UI)"
```

Expected: merge limpo; `bunx vitest run` do web verde em `develop`.

---

## Notas para o executor

- **Eden:** os caminhos com hífen (`["unread-count"]`, `["read-all"]`) usam bracket notation; o param de rota é `notifications({ id }).read.post()`. Confirme o autocomplete tipado ao escrever os hooks.
- **`useSearch` no router code-based:** use `useSearch({ from: "/protected/contracts/$id" })` (o `id` da rota é esse caminho). O `validateSearch` na rota é o que tipa o retorno.
- **Sem literais de tipo:** mensagens/ícones sempre via `NOTIFICATION_TYPE_LABEL`/`NOTIFICATION_TYPE_ICON` indexados por `NOTIFICATION_TYPE`.
- **Design B2:** invoque `frontend-design` ao montar bell/lista/página — nada de cara genérica de IA. Badge usa o tom de destaque do sistema; foco visível e `aria-label` no sininho.
- **Comando de teste:** o pacote usa Vitest; rode `bunx vitest run <arquivo>` a partir de `apps/web` (ou `bun run test` para a suíte toda, conforme o script do `package.json`).
- Se algum mock de `@tanstack/react-router` quebrar outros usos do módulo no mesmo arquivo de teste, prefira `vi.importActual` e sobrescreva só `useNavigate`/`useSearch`/`useParams`.
