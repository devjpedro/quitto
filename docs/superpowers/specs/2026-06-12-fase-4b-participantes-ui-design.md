# Fase 4b — Participantes & Convites (UI) — Design

> **Status:** design aprovado em brainstorming, aguardando revisão final.
> **Data:** 2026-06-12
> **Spec de referência:** `docs/superpowers/specs/2026-06-09-quitto-design.md`.
> **API consumida:** Fase 4a (`plans/2026-06-11-fase-4a-participantes-api.md`), já em `develop`
> (participantes add/remove, criar convite, ver/aceitar convite com trava de e-mail, `actorName` na timeline).

## 1. Visão geral

UI de compartilhamento de contrato: o **dono** gerencia participantes e gera links de convite
travados por e-mail; o **convidado** aceita o convite (vinculando-se ao slot e ganhando acesso por
papel); convites pendentes são **descobertos** ao logar; e o **nome do ator** passa a aparecer na
timeline de auditoria. Consome os endpoints da 4a; adiciona **um** endpoint pequeno de leitura
(`GET /api/invites/mine`) para a descoberta.

> **Convenção (spec §9):** código/identificadores/rotas em inglês; texto ao usuário em pt-BR.
> Constantes de domínio vêm de `@quitto/shared` (`PARTICIPANT_ROLE`); rótulos em `lib/labels.ts`;
> dados via TanStack Query; mutações em hooks; sem Context API.

## 2. Escopo

### Nesta fase (4b)
- **Gestão de participantes (dono)** num **drawer** (`Sheet`) aberto pela tela do contrato: adicionar
  participante (nome + papel), remover participante (com confirmação), e **gerar link de convite**
  por slot não-vinculado (e-mail → link copiável).
- **Tela de aceitar convite** (`/invites/$token`): mostra o contrato e o papel, aceita quando o
  e-mail bate, trata e-mail divergente / expirado / já utilizado.
- **Descoberta leve de convites pendentes** (`GET /api/invites/mine` + banner na lista de contratos).
- **`actorName` na timeline** de auditoria (dado já entregue pela 4a).
- **Login-redirect round-trip**: convidado deslogado que abre o link volta ao convite após autenticar.

### Fora de escopo (fases futuras)
- Envio de e-mail transacional do convite (**Fase 5** — hoje o dono compartilha o link manualmente).
- Sininho / central de notificações in-app (**Fase 5**); a 4b entrega só o banner de descoberta.
- Estado "convite pendente" por slot no lado do **dono** (não há endpoint de listar convites de um
  contrato; convites são gerados sob demanda e não persistem estado de UI).
- Revogar convite (`DELETE`); hoje remover o participante já derruba o convite via `onDelete: cascade`.

## 3. Decisões de UX (do brainstorming)

- **Drawer, não modal centralizado, para a gestão.** Reusa o padrão do `InstallmentDrawer` (`Sheet`):
  **tela inteira no mobile** (largura+altura totais, deslizando da direita), painel à direita no
  desktop. Justificativa: é tarefa deliberada e rara; o link de convite precisa de espaço pra
  ler/copiar; o `Sheet` evita o modal centralizado apertado e o conflito com o teclado de um bottom
  sheet parcial; e reaproveita muscle memory + componente existentes.
- **A leitura continua inline.** A seção "Participantes" da tela do contrato segue read-only como hoje;
  o dono ganha apenas um botão **"Gerenciar"** que abre o drawer. Caso comum (ver quem está no
  contrato) permanece calmo.
- **Convite gerado sob demanda, sem persistir estado.** Ao clicar "Convidar" e gerar, o link aparece
  na hora; não há indicador "pendente" após recarregar (slot só mostra vinculado / não-vinculado).
- **Confirmação de remover via `Dialog`.** Única ação destrutiva → confirmação deliberada; é o caso
  pontual em que o modal centralizado é a ferramenta certa (reusa o padrão de `payment-actions.tsx`).
- **Entrega do convite = copiar link.** Sem infra de e-mail nesta fase; o dono compartilha o link
  manualmente. O e-mail informado serve só pra travar o convite.

## 4. Backend — `GET /api/invites/mine` (única mudança de API)

Em `apps/api/src/modules/invites.ts`, endpoint **autenticado** que lista os convites pendentes do
e-mail da sessão.

- **Filtro:** `invite.email = normalizeEmail(user.email)` **AND** `invite.acceptedAt IS NULL`
  **AND** `invite.expiresAt > now`. Join em `contract` (título) e `participant` (papel).
  Ordenar por `invite.createdAt desc`.
- **Resposta:** `Array<{ token: string; contractTitle: string; role: string; expiresAt: string }>`
  (TypeBox; `role` como `t.String()`, consistente com os demais endpoints).
- **Clean-arch:** sem literais de domínio; reusa `normalizeEmail` e `requireAuth`.
- **Eden:** adicionar `api.api.invites.mine.get` ao `apps/web/tests/eden-types.test.ts`.

## 5. Camada de dados (web)

Padrão de `use-payment-mutations.ts` (mutação → `unwrap(api…)` → invalida query keys).

- **`hooks/use-participant-mutations.ts`:**
  - `useAddParticipantMutation(contractId)` → `POST api.api.contracts({id}).participants` `{displayName, role}`.
  - `useRemoveParticipantMutation(contractId)` → `DELETE …participants({participantId})`.
  - `useCreateInviteMutation(contractId)` → `POST …participants({participantId}).invite` `{email}` → `{token, expiresAt}`.
  - Todas invalidam `queryKeys.contract(contractId)`.
- **`hooks/use-invite.ts`:**
  - `inviteQueryOptions(token)` + `useInviteQuery(token)` → `GET api.api.invites({token})` →
    `{contractTitle, role, email, emailMatches}`.
  - `useAcceptInviteMutation(token)` → `POST api.api.invites({token}).accept` → `{contractId}`;
    invalida `queryKeys.contracts` + `queryKeys.myInvites`.
- **`hooks/use-my-invites.ts`:** `myInvitesQueryOptions` + `useMyInvitesQuery()` → `GET api.api.invites.mine`.
- **`lib/query-keys.ts`:** adicionar `invite(token)` e `myInvites`.

## 6. Gestão de participantes (drawer)

Entrada em `routes/contract-detail.tsx`: quando `data.role === PARTICIPANT_ROLE.owner`, a seção
"Participantes" exibe um botão **"Gerenciar"** que abre o drawer (estado local `useState`).

- **`components/participants-drawer.tsx`** — casca `Sheet`/`SheetContent` (título "Participantes").
  Props: `{ contractId, participants, open, onClose }`. Orquestra lista + ações.
  - Lista cada participante: `displayName`, badge `ROLE_LABEL[role]`, indicador vinculado/não-vinculado.
  - Slot **não-vinculado e não-owner**: botão "Convidar" (abre o fluxo de convite inline no drawer).
  - Slot **não-owner**: controle de remover → `Dialog` de confirmação → `useRemoveParticipantMutation`.
- **`components/add-participant-form.tsx`** — form inline RHF+Zod: `displayName` (1–120) + select de
  papel com opções `PARTICIPANT_ROLE.buyer/seller/viewer` (owner não é adicionável). `useAddParticipantMutation`.
- **Fluxo de convite (inline no drawer):** campo de **e-mail** (RHF+Zod, validação de e-mail) →
  "Gerar link" (`useCreateInviteMutation`) → exibe o **link** (`/invites/<token>`) em input readonly
  + **`components/copy-button.tsx`** (copia pra área de transferência, feedback "Copiado!") + dica:
  "Este link expira em 7 dias e só funciona para esse e-mail."
  - Base da URL: `window.location.origin` + rota de aceitar.

## 7. Tela de aceitar convite (`/invites/$token`)

Rota nova sob `protectedRoute` (a API exige sessão no view e no accept). `routes/accept-invite.tsx`
usa `useInviteQuery(token)`.

- **Loading:** skeleton.
- **Conteúdo:** título do contrato + "Você foi convidado como **{ROLE_LABEL[role]}**".
- **`emailMatches === true`:** botão "Aceitar convite" → `useAcceptInviteMutation` → ao sucesso,
  `navigate({ to: "/contracts/$id", params: { id: contractId } })`.
- **`emailMatches === false`:** mensagem de que o convite é para outro e-mail (`invite.email`),
  mostra o e-mail logado e oferece "Entrar com outra conta" (logout via `authClient`). Aceitar desabilitado.
- **Erros 404/422:** mensagens amigáveis via o mapeamento `ApiError` → `error-message` existente
  (convite não encontrado / expirado / já utilizado).

**Login-redirect round-trip:** `routes/protected.tsx` passa a incluir um search param `redirect`
(href atual) no `redirect({ to: "/login" })`; `routes/login.tsx` navega pra esse destino após
autenticar (default `/`). Convidado deslogado abre o link → login → volta ao convite.

## 8. Banner de descoberta

`components/pending-invites-banner.tsx` usa `useMyInvitesQuery()`. Renderizado no topo de
`routes/contracts-list.tsx`. Sem convites → não renderiza nada (autocontido). Com convites: aviso
"Você tem N convite(s) pendente(s)" listando `contractTitle` + papel + "Ver convite" → `/invites/$token`.

## 9. `actorName` na timeline

`components/audit-timeline.tsx`: adicionar `actorName: string | null` ao tipo `AuditEventView` e
exibir "por {actorName}" junto do rótulo do evento quando presente (dado já vem da 4a no GET da
parcela). Garantir que o tipo/fluxo em `hooks/use-installment.ts` carregue o campo. Aproveitando o
arquivo, mover o mapa `EVENT_LABELS` para `lib/labels.ts` como `AUDIT_TYPE_LABEL` (fecha item de
centralização anotado).

## 10. Testes

- **API (`apps/api/tests/invites.test.ts`):** `GET /invites/mine` — convidado vê o convite pendente;
  convites aceitos e expirados são excluídos; escopo por e-mail (convite de outro e-mail não aparece).
- **Web (vitest + RTL, padrão atual):**
  - drawer de gestão: dono adiciona participante; gerar convite mostra o link; remover pede confirmação.
  - aceitar (`accept-invite`): match → aceita → navega; não-match → botão desabilitado + mensagem; estados de erro.
  - banner: mostra a contagem e os links; ausência de convites não renderiza nada.
  - timeline: renderiza `actorName` quando presente.
  - Eden: `api.api.invites.mine.get` tipado cross-package.

## 11. Arquivos

**Novos**
- `apps/web/src/routes/accept-invite.tsx`
- `apps/web/src/components/participants-drawer.tsx`
- `apps/web/src/components/add-participant-form.tsx`
- `apps/web/src/components/copy-button.tsx`
- `apps/web/src/components/pending-invites-banner.tsx`
- `apps/web/src/hooks/use-participant-mutations.ts`
- `apps/web/src/hooks/use-invite.ts`
- `apps/web/src/hooks/use-my-invites.ts`

**Alterados**
- `apps/api/src/modules/invites.ts` (+ `apps/api/tests/invites.test.ts`)
- `apps/web/src/router.tsx` (rota `/invites/$token`)
- `apps/web/src/routes/contract-detail.tsx` (botão "Gerenciar" + drawer, owner-only)
- `apps/web/src/routes/contracts-list.tsx` (banner)
- `apps/web/src/routes/protected.tsx` + `apps/web/src/routes/login.tsx` (redirect round-trip)
- `apps/web/src/components/audit-timeline.tsx` (+`actorName`)
- `apps/web/src/lib/labels.ts` (`AUDIT_TYPE_LABEL`)
- `apps/web/src/lib/query-keys.ts` (`invite`, `myInvites`)
- `apps/web/tests/eden-types.test.ts` (`invites.mine`)

## 12. Segurança & considerações

- A tela de aceitar e o banner dependem de sessão (endpoints 4a exigem auth). O `GET /invites/:token`
  é um **preview por bearer-token**: retorna título + papel + e-mail a qualquer sessão com um token
  válido, mesmo quando `emailMatches=false` — a tela **não** exibe nada mais sensível que isso, e o
  aceite continua travado por e-mail. (Mascarar o e-mail é melhoria futura, fora de escopo.)
- O link é gerado com `window.location.origin`; em produção o host correto vem do deploy (ver notas de
  deploy do projeto).
