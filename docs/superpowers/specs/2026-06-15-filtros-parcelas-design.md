# Filtros + "carregar mais" na lista de parcelas — Design

**Data:** 2026-06-15
**Status:** aprovado (brainstorming)
**Escopo:** apenas frontend (`@quitto/web`). Sem mudança de API, de tipos Eden ou de comportamento do backend.

## Problema

A tela de contrato (`/contracts/$id`) renderiza **todas** as parcelas numa lista única. Em
contratos longos (até 600 parcelas; 60 é comum) isso vira um scroll enorme, e o que o usuário
realmente quer — "o que falta pagar?" e "tem algo atrasado?" — fica perdido no meio de dezenas
de parcelas já quitadas.

## Decisão de produto

Não é problema de volume de dados (o payload de 600 parcelas, 5 campos cada, é minúsculo e a API
já precisa devolver todas para calcular o resumo). É problema de **renderização e relevância**.
Logo: resolver **100% no front**, sem paginação de backend (que seria over-engineering — já havia
sido adiado como YAGNI).

Default respeita o caso comum (contrato curto): **lista cronológica completa, como hoje**. A
relevância vem de **filtros opt-in**; o comprimento é domado por um **"carregar mais"** que só
aparece quando a lista é longa. Paginação numerada foi descartada (não combina com o modelo mental
"o que pagar agora", pior no mobile, perde contexto).

## Modelo de domínio (já existente em `@quitto/shared`)

Status de parcela: `pending`, `awaiting_confirmation`, `confirmed`, `disputed`, `paid`.

- `isPaidStatus(status)` → `paid` ou `confirmed`.
- `isOverdue(dueDate, status, todayISO)` → vencida, **não** paga e **não** `awaiting_confirmation`.

## Chips de filtro

Quatro chips, seleção única, cada um com contagem. Default = `Todas`. Ordem cronológica
(`sequence` asc) em **todos** os filtros.

| Chip        | Predicado                                   | Observação |
|-------------|---------------------------------------------|------------|
| `Todas`     | todas                                       | default |
| `A pagar`   | `!isPaidStatus(status)`                      | inclui pending, awaiting_confirmation, disputed e as atrasadas |
| `Atrasadas` | `isOverdue(dueDate, status, hoje)`           | subconjunto de "A pagar"; a contagem **bate** com `progress.overdueCount` do resumo |
| `Pagas`     | `isPaidStatus(status)`                       | complemento de "A pagar" |

Propriedade: **`A pagar` + `Pagas` = total** (partição); `Atrasadas` é um destaque dentro de
"A pagar".

## Componentes (separação lógica × UI)

### 1. `apps/web/src/lib/installments-filter.ts` (puro, testável isolado)

```ts
export type InstallmentFilter = "all" | "due" | "overdue" | "paid";

type FilterableInstallment = { dueDate: string; status: string };

export function filterInstallments<T extends FilterableInstallment>(
  items: T[],
  filter: InstallmentFilter,
  todayISO: string
): T[];

export function countByFilter(
  items: FilterableInstallment[],
  todayISO: string
): Record<InstallmentFilter, number>;
```

- Reusa `isPaidStatus` / `isOverdue` do `@quitto/shared` — não redefine regra de domínio.
- Sem estado, sem dependência de React → unit test direto.
- `countByFilter` percorre os itens uma vez computando os quatro contadores.

### 2. `apps/web/src/components/installments-section.tsx` (novo)

Responsabilidade única: renderizar a seção "Parcelas" com chips, lista e "carregar mais".

- Props: `{ installments: Installment[]; onSelect: (id: string) => void }`.
- Estado local (sem Context API, sem `useEffect`):
  - `filter: InstallmentFilter` (`useState("all")`).
  - `visibleCount: number` (`useState(PAGE_SIZE)`).
  - Ao trocar de chip: handler seta o filtro **e** reseta `visibleCount` para `PAGE_SIZE` (num
    único handler — sem efeito de sincronização).
- Derivado no render: `filtered = filterInstallments(installments, filter, todayISO())`;
  `counts = countByFilter(installments, todayISO())`; `shown = filtered.slice(0, visibleCount)`.
- Move para cá a renderização do `<li><button …>` de cada parcela (hoje inline no
  `contract-detail.tsx`), inalterada (mesmas classes, `data-testid`, barra lateral late/normal,
  `isOverdue` por linha).

### 3. `apps/web/src/routes/contract-detail.tsx` (modifica)

- Substitui o `<section>` das parcelas por `<InstallmentsSection installments={installments}
  onSelect={setOpenId} />`.
- **Drawer / deep-link inalterados:** `openId`/`selected = installments.find(...)` continuam no
  `contract-detail` (ligados ao search param `installment`). Como o default é `Todas`, a parcela
  do deep-link está sempre na lista; mesmo que esteja além da janela visível, o drawer abre
  normalmente (lê da lista completa, não exige a `<li>` renderizada). Sem troca automática de
  filtro.

## "Carregar mais"

- Constante `PAGE_SIZE = 15` (em `installments-section.tsx`).
- Botão "Carregar mais" aparece **só** quando `filtered.length > visibleCount`; cada clique soma
  `PAGE_SIZE` a `visibleCount`.
- Contrato curto (ex.: 10 parcelas) → nunca atinge o limiar, mostra tudo, sem botão (igual a hoje).
- Reseta ao trocar de filtro.

## Empty state por filtro

Quando `filtered.length === 0`, mensagem contextual no lugar da lista (segue o padrão de
placeholders centralizados da 7e):

- `Atrasadas` → "Nenhuma parcela atrasada."
- `A pagar` → "Tudo quitado por aqui."
- `Pagas` → "Nenhuma parcela paga ainda."
- `Todas` → (não ocorre: contrato sempre tem ≥ 1 parcela).

## Acessibilidade (precisa passar no portão axe da 7c)

- Grupo dos chips: `role="group"` com `aria-label="Filtrar parcelas"`.
- Cada chip: elemento `button` com `aria-pressed={ativo}`; rótulo inclui a contagem
  (ex.: "A pagar, 3").
- Região `aria-live="polite"` (visível ou `sr-only`) anunciando a contagem do filtro ativo após a
  troca (ex.: "Mostrando 3 parcelas a pagar").
- "Carregar mais" é um `button` comum.

## Rótulos

Rótulos pt-BR dos chips centralizados em `apps/web/src/lib/labels.ts` (`INSTALLMENT_FILTER_LABEL`),
coerente com a centralização de labels já adotada.

## Fora de escopo (YAGNI)

- Nenhuma mudança de API / endpoint / contrato Eden / tipos.
- Resumo (Total/Pago/Restante/%/Atrasadas) segue calculado no servidor sobre **todas** as parcelas.
- Sem páginas numeradas; sem virtualização (desnecessária mesmo no teto de 600 linhas leves).
- Sem persistir o filtro escolhido (estado efêmero por visita).

## Plano de testes

**Unit — `lib/installments-filter.ts`:**
- `filterInstallments` retorna o subconjunto certo por filtro, usando `todayISO` para `overdue`.
- `countByFilter`: contagens corretas; invariante `due + paid === total`; `overdue ≤ due`.
- Casos: parcela `awaiting_confirmation` não conta como `overdue` nem como `paid` (cai em "a pagar").

**Component — `installments-section.tsx`:**
- Default mostra parcelas em ordem cronológica; chip `Todas` ativo (`aria-pressed`).
- Clicar num chip filtra a lista e atualiza `aria-pressed`.
- Contagens exibidas nos chips conferem com os dados.
- "Carregar mais": com > 15 itens no filtro, mostra só 15 + botão; clicar revela mais; com ≤ 15
  não há botão; trocar de filtro reseta a janela.
- Empty state correto por filtro.
- `onSelect` chamado com o `id` ao clicar numa linha.

**Regressão:**
- Suíte web existente segue verde (typecheck/lint/vitest). Atenção: testes de `contract-detail`
  que dependam de "todas as linhas visíveis" podem precisar de ajuste se usarem > 15 parcelas
  (verificar; provavelmente usam poucas).
- Portão axe (e2e da 7c) sem novas violações na rota do contrato.
