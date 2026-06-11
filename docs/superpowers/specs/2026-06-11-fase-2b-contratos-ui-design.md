# Fase 2b — Contratos & Parcelas (UI) — Design

> **Status:** design aprovado em brainstorming (2026-06-11), aguardando revisão final.
> **Fase:** 2b (UI), consome a API entregue na 2a.
> **Spec de referência:** `docs/superpowers/specs/2026-06-09-quitto-design.md` (visão geral, identidade B2, §5 UI/UX, §6 performance/a11y, §8 erros).

## 1. Objetivo & escopo

Entregar a interface web do core de contratos sobre a API tipada da Fase 2a: **listar** contratos do usuário, **criar** um contrato (com cronograma automático ou personalizado) e **ver/editar** um contrato (parcelas + edição de valor/vencimento pelo owner). Uso **solo** ponta a ponta. Sem comprovantes, convites, notificações ou export (fases futuras).

A API consumida (já pronta e tipada via Eden):
- `POST /api/contracts` → `{ id }`
- `GET /api/contracts` → lista com progresso
- `GET /api/contracts/:id` → detalhe (contrato + parcelas ordenadas + participantes + progresso + `role`)
- `PATCH /api/contracts/:id/installments/:installmentId` → edita `amountCents`/`dueDate` (só owner)

> **Convenção (spec §9):** código/identificadores/rotas/comentários em inglês; texto ao usuário em pt-BR. Dinheiro em **centavos** no transporte; formatação R$ é da UI. Datas ISO `YYYY-MM-DD`.

## 2. Páginas e rotas

Todas sob a rota protegida existente (`beforeLoad` → `authClient.getSession()` → redirect `/login`). Router: TanStack Router (code-based), browser history.

| Rota | Tela | Loader (prefetch) |
|---|---|---|
| `/contracts` | Lista de contratos | `ensureQueryData(['contracts'])` |
| `/contracts/new` | Wizard de criação (2 passos) | — |
| `/contracts/:id` | Tela de contrato + drawer da parcela | `ensureQueryData(['contract', id])` |

O dashboard (`/`) permanece como está (placeholder da Fase 1); ligá-lo a dados reais é Fase 6. A sidebar ganha o item **"Contratos"** (`/contracts`).

## 3. Arquitetura do front (blocos novos)

- **`lib/api-client.ts` — `apiClient`**: wrapper fino sobre o Eden `treaty` que executa a chamada, e se vier `error`, lança um **`ApiError` tipado** (`code`, `httpStatus`, `message`, `details?`) derivado do envelope do backend (spec §8); se vier `data`, retorna `data`. Ponto único de import para chamadas de negócio. O `treaty` cru (`lib/api.ts`) continua existindo, mas o app passa a chamar via `apiClient`.
- **Hooks de dados** (`hooks/` ou `features/contracts/`): `useContractsQuery()`, `useContractQuery(id)`, `useCreateContractMutation()`, `useUpdateInstallmentMutation(contractId)`. Encapsulam query keys + chamadas via `apiClient`.
- **Query keys estruturadas**: `['contracts']` (lista), `['contract', id]` (detalhe). Sem `invalidateQueries()` global.
- **Prefetch via route loaders**: loaders chamam `queryClient.ensureQueryData(...)` para evitar waterfalls (spec §6); componentes usam `useQuery` e leem do cache quente.
- **Mutations com invalidação alvo**: criar contrato → invalida `['contracts']` e navega para `/contracts/:id`; editar parcela → invalida `['contract', id]`. Optimistic update no PATCH quando fizer sentido (atualiza a parcela no cache, com rollback no erro).
- **Estado de UI com Zustand** (nunca Context API): store do wizard (dados dos passos + passo atual, navegável sem perda) e estado do drawer (parcela selecionada / aberto). Estado de servidor fica no TanStack Query.

## 4. Componentes de UI

Reaproveita shadcn/Radix já instalados (Button, Card, Input, Label) + novos, todos na identidade **B2** (teal `#0f766e`, superfícies areia, Space Grotesk, ícones lucide, tokens OKLch existentes):
- **StatusBadge** — badge semântico por status de parcela (🟢 paga/confirmada · 🟡 pendente/aguardando · 🔴 atrasada/contestada) e "atrasada há N dias".
- **ProgressBar** — barra de progresso (% quitado).
- **Drawer/Sheet** — painel lateral (Radix Dialog/where apropriado) acessível: foco gerenciado ao abrir, fechar por Esc/overlay, `aria` correto.
- **Stepper** — indicador de passos com bolinhas numeradas (✓ concluído clicável, atual destacado, próximo apagado).
- **Skeleton** — estados de carregamento das telas.
- **CurrencyInput / money utils** — entrada e formatação R$ ⇄ centavos (helpers em `lib/money` no front ou em `@quitto/shared`).

## 5. Telas

### 5.1 Lista de contratos (`/contracts`) — layout "linhas largas"
Uma linha-cartão por contrato (full width), empilhada; colapsa para 1 coluna no mobile. Cada linha usa **apenas os campos que o `GET /api/contracts` entrega**: título, badge do meu papel (`ownerRole`), status do contrato, **ProgressBar** (`percent`), `pago/total` (R$, de `paidCents`/`totalCents`), `installmentsCount`, e badge de atrasadas (`overdueCount > 0`) ou "em dia". Clique → `/contracts/:id`. Cabeçalho com botão **"Novo contrato"** → `/contracts/new`. Estados: loading (skeletons), erro (boundary/toast), **vazio** (CTA "criar seu primeiro contrato").

> **Atenção (lacuna da API):** o `GET /api/contracts` da 2a **não** retorna a "próxima parcela" (data/valor do próximo vencimento) — só o resumo de progresso acima. Mostrar próxima parcela na lista exigiria um campo novo no endpoint (ver decisão em §15). Por isso o layout não inclui esse dado por padrão na 2b.

### 5.2 Criar contrato (`/contracts/new`) — wizard 2 passos
Stepper numerado no topo. Passos preenchidos são clicáveis para voltar; o estado vive no store Zustand, **nada se perde** ao navegar.
- **Passo 1 — Básico:** `title` (1–200), `description` (opcional, ≤2000), `ownerRole` (segmented: comprador/vendedor/neutro), `requiresConfirmation` (toggle). Avançar valida via Zod.
- **Passo 2 — Parcelas:** toggle **Automático / Personalizado**.
  - *Automático:* `totalAmountCents`, `installmentsCount` (1–600), `firstDueDate` → **resumo compacto** ("N parcelas de R$ X · mensais · 1º→último · soma confere ✓") com "ver todas" expansível.
  - *Personalizado:* lista editável de linhas `{ amountCents, dueDate }` com adicionar/remover e **totalizador** que mostra a soma.
  - Botões: "← Voltar" e **"Criar contrato"**. Revisão é inline (o resumo). Submit → `useCreateContractMutation` → toast de sucesso → navega para a tela do contrato criado.

### 5.3 Tela de contrato (`/contracts/:id`) — coluna única + drawer
- **Faixa de stats** (4 cartões): total / pago / restante / atrasadas, + **ProgressBar** e cabeçalho (título, badge do papel, status do contrato).
- **Cartão de participantes** (compacto): na 2b solo, mostra o owner ("Você"); preparado para crescer na Fase 4.
- **Lista de parcelas** (ordenada por sequência): cada linha com nº, vencimento, valor, **StatusBadge**. Clique → abre o **drawer**.
- **Drawer da parcela (ver → editar):** abre da direita sobre a tela, acessível. Modo leitura: nº, valor, vencimento, status (badge). Se `role === "owner"`: botão **"Editar parcela"** revela campos `amountCents`/`dueDate` (RHF + Zod) com **Salvar/Cancelar** → `useUpdateInstallmentMutation` (invalida `['contract', id]`). Para não-owner: drawer só-leitura. Nota discreta: "Comprovantes e marcar como paga → em breve (Fase 3)".

## 6. Fluxo de dados (TanStack Query)
Loader da rota faz `ensureQueryData` → componente lê com `useQuery` (cache quente, sem waterfall). Mutations chamam `apiClient`, com **invalidação alvo** das keys afetadas; optimistic update no PATCH com rollback no erro. `staleTime`/`gcTime` sensatos (já configurados na Fase 1). `select` para minimizar re-render quando útil.

## 7. Tratamento de erros (spec §8)
- `apiClient` lança `ApiError` tipado a partir do envelope `{ error: { code, message, details? } }`.
- `QueryCache`/`MutationCache` com `onError` global → **toast (sonner)** para erros inesperados.
- **Error boundaries por rota** (`react-error-boundary`) com fallback amigável e reset ao navegar.
- Mapa erro→UX por `code`/status: **401 → login** (redirect), **403 → "sem permissão"**, **404 → not-found**, **5xx → genérico** (+ Sentry futuro).
- Erros de validação: `details` do `ApiError` mapeados para os campos do React Hook Form.

## 8. Estado compartilhado (Zustand)
Regra do sistema: **nunca Context API**. Stores Zustand para: (a) **wizard** — `{ step, basic, schedule, setters }`, permitindo voltar sem perder dados; (b) **drawer da parcela** — `{ openInstallmentId, open/close }`. Providers de bibliotecas (QueryClientProvider, RouterProvider, Better Auth) seguem normais — a regra vale para o nosso estado.

## 9. Formulários & validação
React Hook Form + **Zod**. Schemas em **`@quitto/shared`** (reutilizáveis e fonte única no front): `createContractSchema` (incl. união auto/custom espelhando o body da API) e `updateInstallmentSchema`. Mensagens de erro em pt-BR. Os schemas Zod do front são independentes do TypeBox do backend (o backend revalida sempre — defesa em profundidade).

## 10. Responsividade & shell
Telas **responsivas** (reflow mobile). O app shell passa a **bottom-nav no mobile** (sidebar no desktop), com os itens Dashboard e Contratos. Foco em teclado e alvos de toque adequados.

## 11. Diretriz de UI (obrigatória — spec §5)
Ao construir **cada tela/componente visual**, **invocar as skills de design antes** (`frontend-design` / `ui-ux-pro-max` / `web-design-guidelines`). Aterrar na identidade B2; **não** produzir interfaces genéricas com "cara de IA". Os wireframes do brainstorming definiram estrutura/fluxo, não o acabamento — o polimento (ex.: stepper, drawer, cartões) sai na implementação com as skills.

## 12. Testes
Vitest + Testing Library (componente/integração), além do spike de tipos do Eden (mantido). Cobrir os fluxos-chave: render da lista (com progresso, estado vazio), abrir o drawer e editar uma parcela (owner), validação e preview do cronograma no wizard (auto e custom), estados de loading/erro, e o mapeamento de `ApiError` para toast/campo. Mock do `apiClient`/rede onde fizer sentido; sem depender de backend real nos testes de UI.

## 13. Dependências novas (front)
`zustand`, `react-hook-form`, `@hookform/resolvers`, `zod` (já no monorepo), `sonner`, `react-error-boundary`. Componentes shadcn adicionais conforme necessário (sheet/drawer, badge, progress, skeleton). Sem libs de data pesadas — usar helpers/Intl.

## 14. Fora de escopo (fases futuras)
Comprovantes/upload pré-assinado + trilha de auditoria (F3) · marcar parcela como paga / máquina de estados (F3, sem endpoint ainda) · convites e participantes com vínculo (F4) · notificações/sininho (F5) · dashboard real, recibo/quitação PDF, export CSV/PDF, LGPD (F6) · abas Documentos/Histórico na tela de contrato (entram quando houver dado). O drawer apenas sinaliza "em breve".

## 15. Decisões em aberto / a confirmar na implementação
- **"Próxima parcela" na lista:** o `GET /api/contracts` não traz data/valor do próximo vencimento. Duas saídas: (a) **deixar de fora na 2b** (padrão deste design — só o resumo de progresso); ou (b) **adicionar um campo `nextDueDate`/`nextAmountCents` ao endpoint** (pequena alteração de backend, fora do "UI puro" da 2b). Recomendação: (a) na 2b, e revisitar no dashboard (Fase 6). Confirmar com o usuário antes do plano.
- Onde exatamente vivem os helpers de dinheiro/formatação (front `lib/money` vs `@quitto/shared`) — decidir no plano.
- Optimistic update no PATCH: aplicar já na 2b ou só invalidação simples — confirmar custo/benefício na implementação.
- Estrutura de pastas do front (`features/contracts/` vs `pages/` + `hooks/` + `components/`) — alinhar no plano seguindo o padrão da Fase 1.
