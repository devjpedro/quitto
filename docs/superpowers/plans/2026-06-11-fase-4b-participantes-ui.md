# Fase 4b — Participantes & Convites (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: `superpowers:subagent-driven-development` + `superpowers:react-clean-architecture` + (UI) `frontend-design`/`ui-ux-pro-max` na identidade **B2**. Componentes finos: queries/mutations em hooks, validação Zod em `@quitto/shared`, sem literais (use `PARTICIPANT_ROLE`, `ROLE_LABEL`). Steps com checkbox.

**Goal:** UI para o owner gerenciar **participantes** (adicionar/remover), gerar e **copiar o link de convite** (travado por e-mail), uma **tela de aceitar convite** (`/invite/$token`) que retorna ao fluxo após login, e exibir o **nome do ator** na timeline de auditoria. Consome a API da 4a.

**Architecture:** Mutations/queries em hooks (`use-participant-mutations`, `use-invite`); formulários com RHF + Zod (schemas em `@quitto/shared`); diálogos via shadcn `dialog`. A rota de convite vive no nível raiz com guard próprio que, sem sessão, redireciona ao login carregando `redirect` (deep-link de volta). Tudo na identidade B2.

**Tech Stack:** React 19, TanStack Router/Query, RHF + Zod, shadcn/ui, Tailwind v4.

> **Convenção:** código/comentários em inglês; UI pt-BR; sem literais de domínio.
> **Pré-requisitos:** Fases 0–4a em `develop`. Postgres de pé. Branch `feat/fase-4b-participantes-ui` a partir de `develop`. Ao fim, merge em `develop` e marcar 4b no ROADMAP.

---

## Estrutura de arquivos (novos/alterados)

```
packages/shared/src/index.ts        # + addParticipantSchema, inviteEmailSchema
apps/web/src/
├─ components/ui/dialog.tsx          # shadcn (novo)
├─ components/participants-section.tsx  # gerência + convite (novo; extrai do detail)
├─ components/invite-dialog.tsx      # gerar/copiar link (novo)
├─ components/audit-timeline.tsx     # + actorName (alterado)
├─ hooks/use-participant-mutations.ts# add/remove/createInvite (novo)
├─ hooks/use-invite.ts               # query do convite + accept (novo)
├─ lib/query-keys.ts                 # + invite(token) (alterado)
├─ routes/invite.tsx                 # /invite/$token (novo)
├─ routes/login.tsx                  # honra ?redirect (alterado)
├─ routes/contract-detail.tsx        # usa <ParticipantsSection/> (alterado)
└─ router.tsx                        # + inviteRoute; login com validateSearch (alterado)
```

---

## Task 1: shadcn `dialog`

- [ ] **Step 1:** `cd apps/web && bunx shadcn@latest add dialog`
Expected: cria `src/components/ui/dialog.tsx`.

- [ ] **Step 2:** `bun --filter @quitto/web typecheck` → PASS.

- [ ] **Step 3:** Commit
```bash
git add apps/web/src/components/ui/dialog.tsx apps/web/package.json bun.lock
git commit -m "chore(web): adiciona shadcn dialog"
```

---

## Task 2: Schemas compartilhados + hooks de mutation/query

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/src/hooks/use-participant-mutations.ts`, `apps/web/src/hooks/use-invite.ts`
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] **Step 1: Schemas em `@quitto/shared`** (após `updateInstallmentSchema`)

```ts
import { PARTICIPANT_ROLE } from "./domain";

export const addParticipantSchema = z.object({
  displayName: z.string().min(1, "Informe um nome").max(120, "Nome muito longo"),
  role: z.enum([PARTICIPANT_ROLE.buyer, PARTICIPANT_ROLE.seller, PARTICIPANT_ROLE.viewer]),
});
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

export const inviteEmailSchema = z.object({
  email: z.string().email("E-mail inválido"),
});
export type InviteEmailInput = z.infer<typeof inviteEmailSchema>;
```

- [ ] **Step 2: `lib/query-keys.ts`** — adicionar a chave do convite:

```ts
  invite: (token: string) => ["invite", token] as const,
```

- [ ] **Step 3: `hooks/use-participant-mutations.ts`**

```ts
import type { AddParticipantInput } from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useAddParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddParticipantInput) =>
      unwrap(api.api.contracts({ id: contractId }).participants.post(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
  });
}

export function useRemoveParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      unwrap(api.api.contracts({ id: contractId }).participants({ participantId }).delete()),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
  });
}

export function useCreateInviteMutation(contractId: string) {
  return useMutation({
    mutationFn: (vars: { participantId: string; email: string }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId: vars.participantId })
          .invite.post({ email: vars.email }),
      ),
  });
}
```

> **Nota:** confirme os caminhos do Eden contra os endpoints da 4a (`/contracts/:id/participants`, `/participants/:participantId`, `/participants/:participantId/invite`). Ajuste a navegação `api.api...` ao que o Eden expõe.

- [ ] **Step 4: `hooks/use-invite.ts`**

```ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useInviteQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.invite(token),
    queryFn: () => unwrap(api.api.invites({ token }).get()),
    retry: false,
  });
}

export function useAcceptInviteMutation(token: string) {
  return useMutation({
    mutationFn: () => unwrap(api.api.invites({ token }).accept.post()),
  });
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `bun run typecheck`
```bash
git add packages/shared/src/index.ts apps/web/src/hooks/use-participant-mutations.ts apps/web/src/hooks/use-invite.ts apps/web/src/lib/query-keys.ts
git commit -m "feat(web): schemas de participante/convite + hooks de mutation/query"
```

---

## Task 3: `ParticipantsSection` — gerência + convite (design skill)

> Extrai a seção de participantes do `contract-detail` para um componente próprio (componente fino: estado de UI local, ações via hooks). Para o owner: adicionar (dialog), remover, e convidar (gera link). Use a skill de design na identidade B2.

**Files:**
- Create: `apps/web/src/components/participants-section.tsx`
- Create: `apps/web/src/components/invite-dialog.tsx`
- Modify: `apps/web/src/routes/contract-detail.tsx`

- [ ] **Step 1: Invocar a skill de design** para a seção (lista + ações + dialogs) na identidade B2.

- [ ] **Step 2: `invite-dialog.tsx`** — recebe `contractId` + `participant`; abre um dialog, pede e-mail (RHF + `inviteEmailSchema`), chama `useCreateInviteMutation`, e ao receber o `token` mostra o **link** `${window.location.origin}/invite/${token}` com botão **Copiar** (`navigator.clipboard.writeText`) e a validade. Conteúdo pt-BR.

```tsx
// esqueleto — complete com Dialog do shadcn + RHF
const link = token ? `${window.location.origin}/invite/${token}` : null;
// botão copiar:
await navigator.clipboard.writeText(link);
```

- [ ] **Step 3: `participants-section.tsx`** — recebe `contractId`, `role` (do `data.role`) e `participants`. Renderiza a lista (como hoje) e, **se `role === PARTICIPANT_ROLE.owner`**: botão "Adicionar participante" (dialog com `addParticipantSchema`), botão remover por participante não-owner (`useRemoveParticipantMutation`, com confirmação), e botão "Convidar" nos não-vinculados (abre o `InviteDialog`). Sem literais (use `PARTICIPANT_ROLE`/`ROLE_LABEL`).

- [ ] **Step 4: `contract-detail.tsx`** — substituir a `<section>` de Participantes pelo `<ParticipantsSection contractId={contract.id} role={data.role} participants={participants} />`.

- [ ] **Step 5: Typecheck + testes**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test contract-detail participants`
Expected: PASS (adicione um teste de componente para a seção: owner vê "Adicionar"; não-owner não vê).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/participants-section.tsx apps/web/src/components/invite-dialog.tsx apps/web/src/routes/contract-detail.tsx apps/web/tests/
git commit -m "feat(web): gerência de participantes + dialog de convite (copiar link)"
```

---

## Task 4: Rota de aceitar convite `/invite/$token` + redirect pós-login

**Files:**
- Modify: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/invite.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Login honra `?redirect`**

Em `login.tsx`, leia o search param `redirect` (via `Route`/`useSearch`) e use como destino: `callbackURL: redirect ?? "/"` nos `signIn.social`/`signIn.email`/`signUp.email`, e `window.location.href = redirect ?? "/"` no sucesso por e-mail.

- [ ] **Step 2: Router — `validateSearch` no login + rota de convite**

No `router.tsx`, no `loginRoute` adicione:
```ts
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
```
E crie a `inviteRoute` no nível raiz (não sob `protectedRoute`), com guard próprio:
```ts
import { redirect } from "@tanstack/react-router";
import { authClient } from "./lib/auth-client";
import { InvitePage } from "./routes/invite";

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invite/$token",
  beforeLoad: async ({ params }) => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/login", search: { redirect: `/invite/${params.token}` } });
    }
  },
  component: InvitePage,
});
```
Adicione `inviteRoute` aos filhos de `rootRoute` (ao lado de `loginRoute`).

- [ ] **Step 3: `routes/invite.tsx`**

Componente que usa `useParams({ from: "/invite/$token" })`, `useInviteQuery(token)` e `useAcceptInviteMutation(token)`. Renderiza um Card B2 com: título do contrato, papel (`ROLE_LABEL`), e:
- se `data.emailMatches` → botão **Aceitar convite** → `accept` → `navigate({ to: "/contracts/$id", params: { id: contractId } })`.
- se **não** bate → aviso pt-BR: "Este convite é para **{email}**. Entre com essa conta para aceitar." + botão Sair (`signOut`).
- estados de erro (404/expirado/usado) tratados via `isError` da query (mensagem amigável).

- [ ] **Step 4: Typecheck + build + teste**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build && bun --filter @quitto/web test invite`
Expected: PASS (teste de componente: e-mail bate mostra "Aceitar"; não bate mostra o aviso).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/invite.tsx apps/web/src/routes/login.tsx apps/web/src/router.tsx apps/web/tests/
git commit -m "feat(web): tela de aceitar convite + redirect pós-login"
```

---

## Task 5: Nome do ator na timeline

**Files:**
- Modify: `apps/web/src/components/audit-timeline.tsx`

- [ ] **Step 1: Atualizar `AuditEventView` e a renderização** para usar `actorName` (campo que a 4a passou a retornar):

```ts
export interface AuditEventView {
  actorName: string | null;
  createdAt: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  type: string;
}
```
Na linha do evento, abaixo do label, exiba o ator quando houver:
```tsx
{e.actorName ? (
  <span className="text-muted-foreground text-xs">por {e.actorName}</span>
) : null}
```

> **Nota:** confirme o shape real que o `GET /api/installments/:id` retorna (a 4a adicionou `actorName`). Ajuste o tipo para casar com o Eden; se `metadata` não vier mais, remova-o do tipo.

- [ ] **Step 2: Typecheck + teste**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test installment-drawer audit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/audit-timeline.tsx apps/web/tests/
git commit -m "feat(web): exibe nome do ator na timeline de auditoria"
```

---

## Task 6: Fechar — suite, smoke e merge

- [ ] **Step 1: Suite completa**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 2: Smoke manual do fluxo de convite** (opcional, recomendado)

Suba API (Postgres+MinIO) + web. Como owner: abra um contrato → adicione participante → convide (e-mail) → copie o link. Em uma aba anônima/outra conta com o e-mail-alvo, abra o link → aceite → confirme acesso ao contrato. Teste o caminho de e-mail errado.

- [ ] **Step 3: Merge + roadmap**

```bash
git checkout develop
git merge --no-ff feat/fase-4b-participantes-ui -m "Merge da Fase 4b (participantes/convites UI) em develop"
git add docs/superpowers/ROADMAP.md && git commit -m "docs: marca a Fase 4b como concluída"
```

---

## Self-Review (cobertura)

- **Gerenciar participantes (owner add/remove):** Task 3 ✅
- **Gerar/copiar link de convite (travado por e-mail):** Tasks 2, 3 ✅
- **Tela de aceitar convite + retorno pós-login (deep-link):** Task 4 ✅
- **Nome do ator na timeline:** Task 5 ✅
- **Clean-arch:** hooks p/ dados, Zod no shared, sem literais (`PARTICIPANT_ROLE`/`ROLE_LABEL`), componente extraído (`ParticipantsSection`) ✅
- **Design B2 (sem UI genérica):** Task 3 invoca a skill de design ✅
- **Fora de escopo:** revogar convite (DELETE) — backlog/Polimento se desejado; notificação ao aceitar — Fase 5.

> **Verificação de contratos do Eden:** os caminhos `api.api...` nas Tasks 2/5 devem casar com o que a 4a expôs; se algum não existir/typar, ajuste pelo autocomplete do Eden antes de seguir (o spike garante que os tipos existem).
