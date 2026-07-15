---
status: accepted
date: 2026-07-14
---

# Recibo público por token (compartilhar com não-usuário)

Para entregar um recibo a quem **não tem conta** (inquilino, irmão), o app expõe uma **página pública
por recibo**: uma URL só-leitura com **token longo e não-adivinhável**, com **escopo de UM recibo**
(não o contrato inteiro). Serve tanto pro **`wa.me`** (que só carrega texto → precisa de um link) quanto
pro **e-mail**.

## Contexto

A identidade solo-first (ADR-0004) implica comunicar pra fora. O PDF de recibo já existe, mas hoje só faz
sentido dentro do app. O `wa.me` não anexa arquivo, então o WhatsApp exige um link público.

## Decisão

- Página pública mostra o **mínimo**: parcela X paga, valor, data, título do contrato, nomes das partes.
- **Extrato completo** (cronograma + status) **não** vai pra página pública — fica no lado do dono
  (download / e-mail).
- Token com **revogação disponível** por padrão (custo ~zero); **expiração desligada por padrão**
  (escolha do usuário), mas fácil de ligar.

## Consequences

- Superfície pública nova, mas de PII mínima e escopo unitário.
- Habilita os dois canais (WhatsApp + e-mail) com uma peça só.
