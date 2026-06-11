# CD / Deploy Contínuo — Guia de Estudo (aprendizado guiado)

> **Formato:** isto **não** é um plano com código pronto. É um guia de estudo. **Você** escreve o
> pipeline; o Claude atua como **professor** — explica conceitos, revisa o que você fizer, ajuda a
> debugar e responde dúvidas. Os blocos com `# você preenche` são intencionais.

## 1. Objetivo de aprendizado

Transformar o GitHub Actions na **autoridade de deploy** do Quitto: a cada push na branch certa, o
pipeline roda o **portão de qualidade** (lint + typecheck + test + build), aplica **migrations** no
Neon e só então faz **deploy orquestrado** da API (Fly) e do front (Vercel) — com **ambientes** e
**rollback**. Ao fim, você deve saber explicar e implementar: stages/jobs, dependências entre jobs,
triggers, secrets, artifacts/cache, environments e estratégia de rollback.

## 2. Por que (já que Fly/Vercel fazem auto-deploy?)

O auto-deploy nativo publica mesmo com **teste vermelho**, **não roda migrations** e **não coordena**
os dois serviços. O valor deste exercício é exatamente o que falta: **gate de testes + migrations +
orquestração + ambientes/rollback**. Decisão de arquitetura: **desligar o auto-deploy nativo** e
deixar o pipeline como única porta de deploy ("CI owns deploy").

## 3. Conceitos a dominar (pesquise e me pergunte o que não entender)

- **CI vs CD vs Continuous Deployment vs Delivery** — diferença entre "delivery" (pronto pra subir,
  com aprovação manual) e "deployment" (sobe sozinho).
- **Anatomia de pipeline:** workflow → jobs → steps; `needs` (dependência entre jobs); `runs-on`.
- **Triggers:** `on: push` (branches), `pull_request`, `workflow_dispatch` (manual), `environment`.
- **Secrets & OIDC:** `secrets.*`, GitHub Environments com secrets por ambiente; por que **não**
  commitar token.
- **Cache & artifacts:** cache de dependências (Bun) e reuso de build entre jobs.
- **Gate (portão):** job de deploy com `needs: [test, migrate]` — não sobe se algo falhar.
- **Ambientes:** `develop` → ambiente de *staging*; `main` → *production*; preview por PR.
- **Rollback:** como Fly (`fly releases` / `fly deploy --image <anterior>`) e Vercel (promote de um
  deployment anterior) revertem; e rollback de **migration** (por que é o mais perigoso).
- **Deploy strategies:** rolling, blue-green, canary (conceito; o Fly faz rolling por padrão).

## 4. Arquitetura-alvo do pipeline (o "o quê"; o "como" é seu)

```
push (develop|main)
   │
   ▼
[job: verify]  lint + typecheck + test (Postgres service) + build      ← portão
   │ needs
   ▼
[job: migrate] drizzle-kit migrate  → Neon (staging ou prod conforme branch)
   │ needs
   ├─────────────┐
   ▼             ▼
[deploy-api]   [deploy-web]   (Fly via flyctl;  Vercel via vercel --prebuilt)
   │             │
   ▼             ▼
[smoke] curl /api/ping e checa o site no ambiente publicado
```

Regras: `deploy-*` só roda em push (não em PR); `main` = produção (idealmente com aprovação manual
via Environment protegido); `develop` = staging.

## 5. Marcos (você implementa; critério de aceite em cada um)

> Sugestão: branch `feat/cd-pipeline` a partir de `develop`. Faça um marco por commit.

### Marco 0 — Contas e segredos (sem código)
- Criar app no **Fly** (`fly launch`/`fly apps create`) e token de deploy (`fly tokens create deploy`).
- Criar projeto na **Vercel** e um **token**; pegar `ORG_ID`/`PROJECT_ID` (`vercel link`).
- Banco de **staging** no **Neon** (e prod separado).
- Guardar tudo em **GitHub → Settings → Secrets and variables → Actions** (e em **Environments**
  `staging`/`production`).
- ✅ **Aceite:** você consegue listar quais secrets existem e em qual ambiente, sem nenhum valor no repo.

### Marco 1 — Separar o `verify` do deploy
- Refatore o `ci.yml` (ou crie `deploy.yml`) pra ter um job `verify` reaproveitável.
- ✅ **Aceite:** push numa branch qualquer roda só `verify`; ele falha se um teste quebrar.

```yaml
# .github/workflows/deploy.yml  (esqueleto — você preenche)
name: deploy
on:
  push:
    branches: [develop, main]
jobs:
  verify:
    # você preenche: reaproveite os passos do ci.yml (bun install, lint, typecheck, test, build)
  migrate:
    needs: verify
    # você preenche: rodar drizzle-kit migrate contra o Neon do ambiente certo
  deploy-api:
    needs: migrate
    # você preenche: flyctl deploy usando o Dockerfile da api
  deploy-web:
    needs: migrate
    # você preenche: build do web + vercel deploy --prebuilt --prod (se main)
```

### Marco 2 — Migrations no ambiente certo
- Job `migrate` usa `DATABASE_URL` do **secret do ambiente** (staging vs prod por branch).
- ✅ **Aceite:** uma migration nova aplicada via pipeline aparece no Neon de staging ao subir `develop`.
- 🔎 Pesquise: como mapear branch→ambiente (`if: github.ref == 'refs/heads/main'` ou `environment:`).

### Marco 3 — Deploy da API no Fly
- Use a action oficial do flyctl ou instale o CLI; deploy com o token.
- ✅ **Aceite:** o `*.fly.dev` responde a versão nova; `deploy-api` só roda depois de `migrate`.

### Marco 4 — Deploy do Web na Vercel
- **Desligue o Git auto-deploy** da Vercel (Settings) pra evitar deploy duplo.
- Use `vercel pull` + `vercel build` + `vercel deploy --prebuilt` no job.
- ✅ **Aceite:** o site publicado vem do pipeline (não do auto-deploy); preview em PR, prod em `main`.

### Marco 5 — Smoke + gate de produção
- Job `smoke`: `curl` no `/api/ping` publicado e checagem do front.
- Proteja o ambiente `production` com **required reviewers** (aprovação manual).
- ✅ **Aceite:** subir pra `main` **pausa** esperando sua aprovação; smoke falha derruba o pipeline.

### Marco 6 — Rollback (documentar e testar 1x)
- Documente no README como reverter API (Fly releases) e Web (promote anterior na Vercel).
- ✅ **Aceite:** você reverteu a API uma vez de propósito e registrou os comandos.

## 6. Gotchas que vou te lembrar (mas tente sentir na pele)

- **Build context do Docker** é a raiz do monorepo (precisa do `bun.lock` + `packages/shared`).
- **`needs` não compartilha arquivos** automaticamente — use `actions/cache` ou `upload/download-artifact`.
- **Secret vazado em log:** nunca dê `echo` num secret; o GitHub mascara, mas não confie.
- **Migration irreversível** (drop de coluna) num deploy automático = perigo. Pense em migrations
  *aditivas* primeiro.
- **Vercel auto-deploy ligado + pipeline** = dois deploys concorrendo. Desligue um.
- **`workflow_dispatch`** é seu amigo pra testar o pipeline sem ficar fazendo push.

## 7. Como me usar (professor)

- "Me explica `needs` vs `environment`" → aula curta.
- Cola seu YAML → eu **reviso** (não reescrevo do zero) e aponto problemas/segurança.
- Cola o log de erro do Actions → te ajudo a **debugar** (skill systematic-debugging).
- "Por que meu cookie de sessão sumiu no deploy?" → a gente investiga junto.
- Quando terminar um marco, me chama pra revisar antes do próximo.

> Não vou escrever o pipeline por você — esse é o trato. Vou garantir que você entenda cada peça e
> que o resultado seja seguro e correto.
