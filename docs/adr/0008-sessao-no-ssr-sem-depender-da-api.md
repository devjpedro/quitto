---
status: accepted
date: 2026-10-08
---

# Sessão no SSR sem depender da API

O SSR decide o layout (login ou shell) **sem ir à API**, que escala a zero no Fly. A API continua a
única fonte da verdade da sessão: ela valida no banco em **toda** requisição.

## Contexto

O SSR esperava `/api/me` por até 1,5 s e, em cold start, caía em "desconhecido" e num loader de tela
cheia. Pior: qualquer cookie (até o do tema) disparava a ida à API.

## Decisão

- **Sem o cookie de sessão do better-auth** (conferido só pelo nome): `redirect /login`, sem rede.
- **Com o cookie**: o shell renderiza na hora. O nome vem de um **cookie de identidade cosmético**,
  `quitto_identity`, que o **cliente** grava depois do `/api/me` (id, nome, e-mail, imagem; 30 dias).
  Ele só serve para exibição e **nunca autoriza nada**: qualquer um pode escrevê-lo.
- **Sem o cookie de identidade**, o SSR pergunta ao `/api/me` com timeout curto: 200 → autenticado,
  401 → `/login`, timeout ou 5xx → "desconhecido" (o shell abre e o cliente confirma).
- **Nenhum segredo na Vercel.** Descartamos o *cookie cache* do better-auth: ele só vale 5 minutos
  depois do login e exigiria o `BETTER_AUTH_SECRET` no web.
- **A API valida no banco** em cada chamada; um cookie de identidade forjado não abre dado algum.
  Sessão revogada (logout, exclusão de conta) devolve 401 e o cliente limpa o cookie.

## Consequences

- O primeiro paint não espera o Fly; as seções carregam em streaming, com skeleton por seção.
- Quem forja `quitto_identity` só vê o próprio nome errado no shell, sem dado de ninguém.
- Trocar de conta no mesmo navegador exige limpar o cookie de identidade (o logout faz isso).
