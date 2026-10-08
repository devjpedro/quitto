---
status: accepted
date: 2026-10-08
---

# A chave PIX vive no contato, não no contrato

A chave que paga uma parcela vem de **quem recebe**: da conta (`user.pix_key`) quando o recebedor tem
conta, ou do **contato** (`participant.pix_key`) quando não tem. O contrato **não** guarda mais chave.

## Contexto

A ADR-0005 criou a chave por contrato (`contract.pix_key`), como um *override*. Na prática, a mesma
pessoa recebia em vários contratos com a mesma chave, e o override gerava divergência. O redesign
adotou "uma chave por conta" e a tela **Pessoas** precisava de um lugar para a chave de quem não tem conta.

## Decisão

- Quem recebe **com conta**: vale a chave da conta, nunca a do contato.
- Quem recebe **sem conta** (contato vendedor num contrato que o dono paga): vale
  `participant.pix_key`, editável pelo dono (`PATCH /contracts/:id/participants/:id/pix-key`).
- A migration **0019** acrescentou `participant.pix_key` e copiou `contract.pix_key` para o
  participante vendedor. A **0020** apaga `contract.pix_key` na **contração** (PR à parte, depois do deploy do redesign);
  nela o `PATCH /contracts/:id` passa a editar só título e descrição e o detalhe deixa de trazer `pixKey` e
  `recebedor` (o web lê `receiver`). Desde a Fase 2 o código já ignora a chave do contrato.
- O espectador nunca recebe a chave.

## Consequences

- Um contrato com chave diferente da do contato perdia o override; a consulta de impacto do
  checklist de ops conta esses casos antes de rodar a 0020.
- Continua sem PSP e sem confirmação automática (ADR-0005).
