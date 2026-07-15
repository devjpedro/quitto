---
status: accepted
date: 2026-07-14
---

# PIX estático (BR Code), sem PSP nem reconciliação

Suportar **PIX estático**: o dono guarda a própria chave PIX e o app gera o **copia-e-cola (BR Code /
EMV) + QR** com o valor da parcela embutido. **Não** há integração bancária, credencial de PSP, webhook
nem reconciliação automática — o dono segue marcando pago / anexando comprovante como hoje.

## Contexto

PIX tem duas versões com riscos **opostos**. O **estático** é só uma string formatada (chave + nome +
cidade + valor + txid + CRC16) gerada localmente: não toca banco, não move dinheiro, não guarda segredo
de pagamento. O **dinâmico** (saber que foi pago) exige PSP + webhooks + credenciais — a superfície de
segurança/compliance que a `requisitos.md §4` lista como "pagamento real / integração bancária".

## Decisão

Fazer só o **estático**. A chave é guardada em **ambos** os níveis: **default no perfil** do dono +
**override por contrato** (nullable; cai no default se ausente). A preocupação de segurança do usuário é
válida pro dinâmico e **se dissolve** no estático: a chave é a **do próprio dono** (RBAC: só ele edita a
própria chave), validada em formato.
O risco clássico (pagar pra chave errada) é mitigado porque só o dono define a chave, dentro do próprio contrato.

## Consequences

- Todo o valor prático (o outro lado paga num toque) com risco quase nulo.
- Reconciliação automática (via PSP) fica documentada como **roadmap**, não implementada.
