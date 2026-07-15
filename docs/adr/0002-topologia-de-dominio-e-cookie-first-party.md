---
status: accepted
date: 2026-07-14
---

# Topologia de domínio e cookie de sessão first-party

Registrar **`usequitto.app.br`** (registro.br) e servir a **landing no apex** (`usequitto.app.br`, SSG)
e o **produto num subdomínio** (`conta.usequitto.app.br`). O proxy `/api/*` fica **no mesmo host do app**,
mantendo o **cookie de sessão first-party** — a trava que hoje justifica toda a topologia same-origin.

> Nota: o subdomínio do produto é `conta.` (não `app.`) porque `app.usequitto.app.br` gaguejaria com o
> TLD `.app.br`. `usequitto.com`/`.com.br` estavam indisponíveis no registro.

## Contexto

Hoje o front vive em `usequitto.vercel.app` (domínio compartilhado da Vercel), que dá **um** nome só
(sem subdomínios) e não acumula autoridade de SEO pra marca. O hosting é R$0 (Vercel Hobby + Fly
scale-to-zero) e queremos preservar isso.

## Decisão

- **Domínio próprio** (~R$40/ano de registro; **hosting segue R$0** no Hobby).
- **apex = landing** (`usequitto.app.br`, SSG, indexável) · **produto = `conta.`** (`conta.usequitto.app.br`).
- **Cookie first-party**: o app em `conta.usequitto.app.br` chama `conta.usequitto.app.br/api/*` (rewrite →
  Fly), então o cookie é **host-scoped** de `conta.`. A landing é anônima e não precisa de cookie. Nota:
  `.app.br` é sufixo público (registro.br); como o cookie é host-only no subdomínio do app, não há
  pegadinha de public-suffix. HTTPS é obrigatório e provisionado pela Vercel no custom domain.
- **Não** usar domínios separados de verdade (fragmenta marca e SEO sem ganho).

## Consequences

- O **mesmo domínio** destrava três coisas de uma vez: SEO da landing, subdomínio `app.` first-party e
  **entrega de e-mail** (domínio verificado no Resend — ver ADR-0005 de e-mail em `requisitos.md` e o plano).
- Vercel Hobby é, por ToS, uso não-comercial; enquanto o Quitto é pessoal/portfólio, ok.
