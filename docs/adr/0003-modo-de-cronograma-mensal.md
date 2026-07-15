---
status: accepted
date: 2026-07-14
---

# Modo de cronograma "mensal" (contrato finito que guarda a intenção)

Adicionar um terceiro **modo de cronograma** — `mensal` — ao lado de `auto` e `custom`:
o usuário informa **valor mensal + nº de meses** (+ 1º vencimento) e o sistema gera N parcelas
**iguais e exatas**. O contrato **guarda a intenção** (valor mensal + nº de meses), não só as parcelas.

## Contexto

O usuário pediu "recorrência", mas o exemplo (aluguel × tempo de contrato) é **finito** — ele calcula
um total. Recorrência **aberta de verdade** (prazo indeterminado, renovação) segue fora de escopo.
Hoje o único jeito de lançar um aluguel de R$800/mês é calcular o total (R$800 × N) e usar o modo `auto`.

## Decisão

- Novo branch no discriminated union do schedule (`packages/shared`):
  `{ mode: "monthly", monthlyAmountCents, months, firstDueDate }`.
- Como o valor mensal é **exato**, `mensal × N` divide certo em N parcelas iguais — sem resto pra
  distribuir (mais simples que o `auto`).
- O `contract` passa a guardar `monthlyAmountCents` (nullable; `null` = não-mensal). `installmentsCount`
  = meses; `totalAmountCents` = mensal × meses.

## Consequences

- Habilita label claro ("R$800/mês · 12 meses"), extrato melhor e o futuro **"estender por +N meses"**
  — a ponte natural pra recorrência aberta, se um dia entrar.
- Não muda a máquina de estados da parcela nem o RBAC.
