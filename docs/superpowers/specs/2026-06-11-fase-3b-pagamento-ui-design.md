# Fase 3b — Pagamento & Comprovantes (UI) — Design

> **Status:** design aprovado em brainstorming, aguardando revisão final.
> **Data:** 2026-06-11
> **Spec de referência:** `docs/superpowers/specs/2026-06-09-quitto-design.md` (§5 UI, §7 segurança upload).
> **API consumida:** Fase 3a (`plans/2026-06-11-fase-3a-pagamento-api.md`), já em `develop`.

## 1. Visão geral

UI do fluxo de pagamento dentro do **drawer da parcela**: anexar comprovante (via URL pré-assinada),
agir conforme o papel (confirmar/contestar/marcar paga), e ver a trilha de auditoria. Consome os
endpoints da Fase 3a. A tela de contrato continua como está (lista flat → drawer); **não** há
refatoração em abas nem PDF do contrato original nesta fase.

> **Convenção (spec §9):** código/identificadores/rotas em inglês; texto ao usuário em pt-BR.
> Dinheiro em centavos.

## 2. Escopo

### Nesta fase (3b)
- **Detalhe da parcela** no drawer como fonte da verdade (GET `/api/installments/:id`): status,
  comprovantes (com URL de download assinada) e timeline de eventos.
- **Upload de comprovante** (comprador/dono): selecionar → revisar (nome/tamanho/tipo, validação
  local pdf/jpg/png ≤10MB) → "Enviar comprovante" (presign → PUT direto no storage → confirm).
- **Ações por papel** (vendedor/dono): **Confirmar pagamento** (diálogo de confirmação) e
  **Contestar** (diálogo com motivo opcional, máx. 500). Comprador/dono: **Marcar como paga**
  (fluxo sem confirmação).
- **Lista de comprovantes** com link "baixar" (abre a URL assinada em nova aba).
- **Timeline de auditoria** (label pt-BR por tipo de evento, data, motivo da contestação). **Nome do
  ator fica deferido** — a API (3a) só devolve `actorUserId` e o detalhe do contrato não expõe o
  vínculo `linkedUserId` dos participantes, então não há como resolver o nome no cliente ainda (§7).
- **Badges de status** reaproveitando o `status-badge` existente.

### Fora de escopo (fases futuras)
- Abas Parcelas/Participantes/Documentos/Histórico na tela de contrato.
- Upload/visualização do **PDF do contrato original** (aba Documentos).
- Participantes & convites (**Fase 4**) — ver §7.
- Notificações in-app ao confirmar/contestar (**Fase 5**).

## 3. Decisões de UX (do brainstorming)

- **Layout do drawer:** empilhado com scroll (comprovantes → ações → histórico). Sem abas internas
  nem rodapé fixo no MVP — a parcela tem pouca informação; evoluível depois se a lista crescer.
- **Upload:** selecionar → revisar → enviar (evita envio acidental; valida tipo/tamanho antes da rede).
- **Confirmar/contestar:** confirmar abre diálogo curto (ação quase irreversível); contestar abre
  diálogo com textarea de motivo **opcional** (alinha com a API, que aceita vazio).
- **`owner` enxerga os dois lados** (envia *e* confirma) — espelha o RBAC do backend e habilita o
  **uso solo** sem caso especial.
- **Sem optimistic update:** o status é autoridade do servidor; usamos invalidação alvo.

## 4. Matriz de ações (papel × status × exigeConfirmação)

A UI espelha o RBAC + a máquina de estados da 3a; **o backend continua sendo a autoridade**. O drawer
calcula a visibilidade dos botões a partir de (`contractRole`, `requiresConfirmation`, `status`).

**Contrato COM confirmação:**

| status | `buyer`/`owner` | `seller`/`owner` |
|---|---|---|
| `pending` | Enviar comprovante | — |
| `awaiting_confirmation` | — | Confirmar pagamento · Contestar |
| `disputed` | Reenviar comprovante | — |
| `confirmed` | — | — |

**Contrato SEM confirmação:**

| status | `buyer`/`owner` | `seller`/`owner` |
|---|---|---|
| `pending` | Enviar comprovante *e/ou* Marcar como paga | — |
| `paid` | — | — |

- **Sempre visível** (qualquer papel com acesso, inclusive `viewer`): lista de comprovantes + timeline.
- **`viewer` nunca vê botões de ação.**
- Edição de valor/vencimento (owner) — mantém o comportamento atual do drawer (2a/2b).

## 5. Arquitetura & componentes

### Refatorar
- `apps/web/src/components/installment-drawer.tsx` — renomeia prop `role` → `contractRole`; busca o
  detalhe da parcela (GET 3a) como fonte da verdade; orquestra as sub-peças; mantém a edição de
  valor/vencimento do owner.

### Novos componentes (`apps/web/src/components/`)
- `proof-upload.tsx` — selecionar → revisar → enviar; validação local (pdf/jpg/png, 0 < tamanho ≤ 10MB).
- `proof-list.tsx` — comprovantes com link "baixar" (URL assinada).
- `payment-actions.tsx` — botões cientes de papel/status (Confirmar, Contestar, Marcar paga) + diálogos.
- `audit-timeline.tsx` — eventos com label pt-BR, data e motivo (metadata). Ator deferido (ver §7).
- `ui/dialog.tsx` — wrapper Radix Dialog (hoje só existe `Sheet`) para confirmar/contestar.

### Novos hooks (`apps/web/src/hooks/`)
- `use-installment.ts` — `installmentQueryOptions(id)` + `useInstallmentQuery(id)` → GET `/api/installments/:id`.
- `use-payment-mutations.ts` — `useSubmitProofMutation`, `useConfirmPaymentMutation`,
  `useDisputePaymentMutation`, `useMarkPaidMutation`.

### Query keys
- Adicionar `installment: (id) => ["installment", id]` em `lib/query-keys.ts`.

### Mapeamentos
- **Evento → label pt-BR:** `proof_submitted` → "Comprovante enviado"; `payment_confirmed` →
  "Pagamento confirmado"; `payment_disputed` → "Pagamento contestado"; `installment_paid` → "Parcela paga".

## 6. Fluxo de dados, cache e erros

- **Abertura:** drawer recebe `installmentId`, `contractId`, `contractRole`, `requiresConfirmation`
  (já carregados via `useContractQuery` na tela de contrato).
- **Detalhe:** `useInstallmentQuery(id)` (GET `/api/installments/:id`) dita status/comprovantes/eventos.
- **Upload (hook composto `useSubmitProofMutation`):** valida local → presign → `PUT` cru no storage
  (com `content-type` do arquivo) → confirm → invalida. `fileName` = `file.name`, `mimeType` = `file.type`.
- **Invalidação alvo:** toda mutação invalida `["installment", id]`, `["contract", contractId]` e
  `["contracts"]` (status e progresso mudam). Sem optimistic update.
- **Erros:** 403 → "sem permissão"; **422 (transição inválida — outra parte agiu antes) → toast
  "a parcela mudou, recarregamos" + refetch**; 404 → fecha o drawer; inesperados → toast global.
  **Sucesso** com toast curto por ação.
- **Download:** abre a `downloadUrl` assinada (GET, 5 min) em nova aba.

## 7. Interação com o roadmap (importante)

- **Participantes & convites são a Fase 4.** Hoje não há como vincular uma contraparte
  (`seller`/`buyer`), então todo contrato é efetivamente **solo** e o fluxo "vendedor confirma/contesta"
  só vira exercitável de fato na Fase 4. Construímos a UI agora (junto do código de pagamento) para
  ficar **pronta** quando os participantes existirem; o backend (3a) já suporta os dois fluxos.
- **Follow-up (criação de contrato / 2b, fora desta fase):** ao criar contrato solo, desabilitar/ocultar
  `exigeConfirmação` ou avisar que só faz sentido com contraparte — para não impor a cerimônia de
  autoconfirmação. O drawer 3b **não** faz special-case de "solo" (estado frágil de detectar e que muda
  na Fase 4); ele honra o flag fielmente.
- **Follow-up (nome do ator na timeline):** para exibir *quem* fez cada evento, a API precisa expor o
  ator de forma resolvível — ex.: o detalhe da parcela (GET 3a) devolver o nome do ator por evento, ou
  o detalhe do contrato expor `linkedUserId` dos participantes + a sessão atual. Enquanto isso, a
  timeline mostra só evento + data + motivo.

## 8. Testes

- **Vitest + Testing Library**, mockando os hooks de mutação (padrão do `installment-drawer.test.tsx`).
- **Matriz de ações:** combinações de (`contractRole`, `requiresConfirmation`, `status`) afirmando
  botões visíveis/ocultos (`viewer` sem ações; `seller` só Confirmar/Contestar em
  `awaiting_confirmation`; `buyer` com Enviar em `pending`/`disputed`).
- **Upload:** arquivo inválido (tipo/tamanho) → erro local, sem mutação; válido → chama o hook com o arquivo.
- **Diálogos:** Confirmar abre diálogo → confirma → mutação; Contestar passa `reason` opcional.
- **Timeline:** eventos renderizam label pt-BR + motivo da contestação.
- **Eden types:** estender `eden-types.test.ts` cobrindo os endpoints novos de parcela (tipagem cross-package).

## 9. Diretriz de UI (obrigatória, spec §5)

Aterrar na identidade **B2** (areia/teal, cantos suaves, status semânticos: verde=paga/confirmada,
âmbar=pendente/aguardando, vermelho=vencida/contestada). Usar skills de design ao construir; foco
gerenciado ao abrir diálogos/drawer (a11y WCAG 2.2 AA — teclado, foco, ARIA). Nada de UI genérica.
