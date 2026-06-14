# Fase 7e — UX polish (placeholders genéricos + responsivo mobile) — Design

**Data:** 2026-06-14
**Escopo:** Web-only. **Sem mudança de API.** Sem tela nova (sem `frontend-design`).
**Origem:** dogfooding mobile do usuário — placeholders com exemplos pessoais e vários ajustes de responsivo a 320px.

## Objetivo

Deixar o app apresentável e confortável no celular (alvo de uso principal): trocar placeholders pessoais por exemplos genéricos e centralizados, e corrigir os pontos de layout que quebram em telas estreitas (~320px).

## Convenções

Código em inglês; sem literais espalhados (centralizar copy); sem comentários óbvios. Mobile-first (`base` = mobile, `sm:`+ = telas maiores). Os testes existentes não podem regredir.

---

## Parte 1 — Placeholders genéricos e centralizados

Hoje os exemplos são literais inline em componentes, contra a convenção "sem literais" do projeto. Centralizar os textos de exemplo de formulário num único ponto (estender `apps/web/src/lib/labels.ts` ou criar um módulo enxuto `apps/web/src/lib/form-copy.ts` — decisão do plano, mantendo YAGNI) e trocar os três por texto neutro:

| Arquivo | Campo | Antes | Depois |
|---|---|---|---|
| `routes/contract-new.tsx:77` | Título do contrato | `Ex.: Apartamento do irmão` | `Ex.: Aluguel do apartamento` |
| `components/add-participant-form.tsx:88` | Nome do participante | `Ex.: Irmão` | `Ex.: Maria` |
| `components/payment-actions.tsx:142` | Motivo da contestação | `Ex.: não identifiquei o valor na conta` | `Ex.: valor diferente do combinado` |

Os placeholders genéricos já aceitáveis (`pessoa@exemplo.com`, `Detalhes do acordo`) podem ser movidos para o mesmo ponto central por consistência, mas não mudam de texto.

---

## Parte 2 — Responsivo mobile (320px)

Mudanças cirúrgicas, mobile-first. Nenhuma altera comportamento/lógica — só layout/classes Tailwind.

### 2.1 Padding de página
Todas as rotas usam `p-6` fixo (48px somados em 320px). Trocar por `p-4 sm:p-6` nas rotas afetadas (detalhe do contrato, novo contrato, notificações, lista) e no padding interno do `Sheet` (`components/ui/sheet.tsx`, `p-6` → `p-4 sm:p-6`).

### 2.2 Linha de parcela (detalhe do contrato)
`routes/contract-detail.tsx` (~186). A linha é `flex items-center gap-3`; o valor "R$ 0,50" quebra em duas linhas. Ajuste:
- data: `min-w-0 truncate` (cede espaço)
- valor: `shrink-0 whitespace-nowrap`
- badge de status: `shrink-0`

Resultado: data trunca se necessário, valor nunca quebra.

### 2.3 Wizard — parcelas personalizadas
`routes/contract-new.tsx` (CustomSchedule, ~182). Hoje `flex items-end gap-2` com dois `flex-1` + lixeira → input de data trunca ("dd/m"). Ajuste: empilhar Valor/Vencimento no mobile e ir inline a partir de `sm` (`flex-col sm:flex-row sm:items-end`), mantendo o botão remover acessível e rotulado. Os dois inputs ganham largura total no mobile, então o placeholder `dd/mm/aaaa` cabe.

### 2.4 Header de Notificações
`routes/notifications.tsx` (~32). `flex items-center justify-between` → `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`. Opcional: título `text-xl sm:text-2xl`. A ação "Marcar todas como lidas" deixa de espremer o título.

### 2.5 Itens de participante (nome quebra ao lado dos badges)
Dois lugares com o mesmo problema:
- `components/participants-drawer.tsx` (ParticipantItem, ~170)
- `routes/contract-detail.tsx` (seção PARTICIPANTES, ~159)

Permitir wrap: a linha vira `flex flex-wrap items-center gap-x-2 gap-y-1` (ou nome em bloco próprio com badges em linha abaixo), nome com `min-w-0`. Os badges reflowam abaixo do nome em vez de espremer.

### 2.6 Pontos cinzas soltos (#3/#4/#7)
Apareceram círculos cinzas fora do card no wizard de novo contrato e no Sheet de participantes. **Não foram localizados no código** numa varredura inicial (CSS, pseudo-elementos, overlays Radix). Tarefa:
1. **Reproduzir** rodando o app em dev a 320px.
2. Se for elemento nosso (ex.: indicador mal-posicionado, handle, resíduo), corrigir.
3. Se for artefato do DevTools (device mode/scrollbar), documentar a conclusão e fechar — **não inventar fix**.

---

## Testes

Responsivo é difícil de cobrir em unit test de forma significativa; a verificação principal é visual no dev (320px). Garantias automáticas:
- A suíte web existente (`bunx vitest run`) não pode regredir — as mudanças são de classes/copy.
- Se a copy for centralizada, um teste leve pode afirmar que os componentes usam a constante (opcional, só se agregar valor — YAGNI).

## Fora de escopo
- Qualquer mudança de API.
- Redesign de telas / novos componentes.
- a11y/WCAG (Fase 7c) e performance/Lighthouse (Fase 7d) ficam para suas fases.
