---
status: accepted
date: 2026-10-08
supersedes: "0003 (parcialmente: os modos auto e custom)"
---

# Cronograma `split` / `monthly`, com "Ajustar uma a uma"

O corpo de `POST /api/contracts` aceita **dois** modos de cronograma, mais um ajuste manual opcional:

- `split`: valor **total** ÷ nº de parcelas (o resto vai para as primeiras);
- `monthly`: valor **mensal** × nº de meses (o contrato guarda a intenção, como na ADR-0003);
- `installments[]` (opcional, no corpo, ao lado do `schedule`): as parcelas exatas do
  "Ajustar uma a uma". Precisa bater com a contagem do modo e a soma com o total.

## Contexto

A ADR-0003 acrescentou `monthly` aos modos `auto` e `custom`. No redesign, o wizard pergunta
"Como o pagamento foi combinado?" (duas respostas) e deixa **ajustar valores e datas** em cima do
cronograma já gerado. Três modos viraram dois mais um ajuste, e `auto` e `custom` ficaram sem uso.

## Decisão

- `auto` passou a se chamar `split`. `custom` (as linhas dentro do `schedule`) saiu: o ajuste manual
  é `installments[]` sobre um `split` ou `monthly`.
- Um contrato ajustado à mão **não é mais "mensal fixo"**: `monthly_amount_cents` fica nulo.
- Os modos `auto` e `custom` foram **removidos** do schema (`shared`) e da API na Fase 6 do
  redesign; pedir um deles devolve 422. Os contratos já criados não mudam (as parcelas estão no banco).

## Consequences

- O que a ADR-0003 diz de `monthly` continua valendo; o que diz de `auto` e `custom` está superado.
- Um só caminho de criação no back (`buildSchedule`), um só schema no zod.
