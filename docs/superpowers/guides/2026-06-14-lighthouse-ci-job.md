# Guia de estudo — job de Lighthouse no CI (Fase 7d)

> **Escopo / fronteira CD.** Este documento é **material de estudo**, não o arquivo de
> workflow final. Pela mesma regra das fases CD (GitHub Actions é dono do deploy e do CI —
> **o usuário escreve o YAML, o Claude ensina**), o que segue descreve **o que** o job
> `lighthouse` precisa, com trechos **ilustrativos**. Adapte e escreva o
> `.github/workflows/ci.yml` você mesmo. **NÃO** há nada em `.github/workflows` tocado por
> esta fase.

## O que a Fase 7d entregou (contexto)

A Fase 7d focou em performance de carregamento do web (`@quitto/web`, Vite 8 / Rolldown):

- **Code-splitting por rota** — cada rota vira um chunk `lazy`, carregado sob demanda.
- **Vendor chunks** via `manualChunks` (forma **função**, não objeto — obrigatório no
  Rolldown/Vite 8): `react` e `tanstack` saem em chunks próprios, cacheáveis entre deploys.
- **Meta SEO / `theme-color`** e **`font-display: swap`**.
- **Orçamento Lighthouse asserido** via `@lhci/cli` no `/login` (config em
  `apps/web/lighthouserc.json`).

O `lhci autorun` lê esse `lighthouserc.json`: ele **sobe** `vite preview` na porta 4173, mede
o `/login` **3 vezes** (preset `desktop`), aplica as `assertions` e grava o relatório em
`apps/web/.lighthouseci`.

## Por que `/login` (rota pública) e não o dashboard

O gate automatizado mede **`/login`** porque é uma rota **pública** — não exige sessão nem
backend de pé. O `vite preview` serve só o bundle estático do web; o `/login` renderiza por
inteiro sem nenhuma chamada autenticada, então o Lighthouse roda **sem subir a API**. Isso
mantém o job barato e determinístico (sem Postgres/MinIO, sem seed de usuário).

Rotas **autenticadas** (ex.: `/` dashboard, `/contracts/$id`) ficam **FORA** do gate
automatizado — ver "Medição manual" abaixo.

## Anatomia do job `lighthouse` (SEPARADO do `verify`)

Mantenha `lighthouse` como **job distinto** do `verify` (lint/typecheck/test/build) e do
`e2e`. Ele é leve, mas baixa o Chrome; misturar com o gate rápido o deixa lento. Se quiser
rodar só depois do gate, use `needs: verify`.

### Não precisa de `services`

Ao contrário do `verify`/`e2e`, este job **não precisa** de Postgres nem MinIO: o `/login`
é estático e o `vite preview` não fala com a API. Sem `services`, sem bloco `env` de DB/S3.

### Steps, em ordem

1. `actions/checkout@v4`
2. `oven-sh/setup-bun@v2` (`bun-version: latest`)
3. `bun install --frozen-lockfile`
4. **Build do web** — `bun run --filter @quitto/web build`
   (forma `run` **antes** do `--filter` — ver gotcha 1). Gera o `apps/web/dist` que o
   `vite preview` vai servir.
5. **Instalar o Chrome** — `npx playwright install --with-deps chrome`
   (forma CI-friendly: traz as libs de sistema do runner). Ver gotcha 2.
6. **Rodar o `lhci`** — `cd apps/web && bunx lhci autorun`. O `autorun` lê o
   `lighthouserc.json`: sobe o `vite preview` na 4173, mede `/login` 3×, **assere** o
   orçamento e grava em `apps/web/.lighthouseci`. Se qualquer `assertion` falhar, o `lhci`
   sai com código ≠ 0 e o job **quebra** — é o gate.

### Artefato — publique o relatório SEMPRE

Diferente do `playwright-report` (que sobe só em `failure()`), o relatório do Lighthouse é
útil como **evidência de portfólio** mesmo no verde. Suba `apps/web/.lighthouseci`:

```yaml
# ilustrativo
- name: upload lighthouse report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: lighthouse-report
    path: apps/web/.lighthouseci
    retention-days: 30
```

(Se quiser links públicos por run, troque o `upload.target` do `lighthouserc.json` para
`temporary-public-storage` em vez de `filesystem` — mas isso publica o relatório num bucket
externo do LHCI; o `filesystem` + artefato do Actions é o caminho privado.)

## Esqueleto ilustrativo do job (NÃO é o arquivo final)

```yaml
# ILUSTRATIVO — escreva o seu em .github/workflows/ci.yml
  lighthouse:
    runs-on: ubuntu-latest
    # needs: verify   # opcional, se quiser rodar após o gate rápido
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun run --filter @quitto/web build         # gotcha 1
      - run: npx playwright install --with-deps chrome   # gotcha 2
      - run: cd apps/web && bunx lhci autorun
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: lighthouse-report, path: apps/web/.lighthouseci }
```

## Gotchas

### 1. Sintaxe do `--filter` no bun

`bun --filter <pkg> run <script>` (filtro **antes** do `run` posicional) **FALHA** com
`No packages matched the filter` em bun recente (1.3.x). Use **`bun run --filter @quitto/web
build`** (`run` primeiro). Mesmo gotcha do guia de E2E.

### 2. Instalar o Chrome no runner

O Lighthouse precisa de um Chrome real.

- ✅ Forma CI-friendly: **`npx playwright install --with-deps chrome`** — instala o Chrome
  **e as libs de sistema** do runner num passo só.
- Alternativa: usar o Chromium que o próprio `lhci` baixa, ou exportar **`CHROME_PATH`**
  apontando para um Chromium já em cache (acelera reruns).
- ⚠️ Localmente, `bunx playwright install chrome` pode pedir **sudo** para as deps de
  sistema; no runner do GitHub o `--with-deps` resolve isso sem prompt.

### 3. `manualChunks` é função no Vite 8 (Rolldown)

O repo usa **Vite 8 (Rolldown)** — `manualChunks` precisa ser a **forma função**, não a
forma objeto. Já está assim no `apps/web/vite.config.ts`; cite isto se for revisar/portar a
config de bundling.

## Números medidos (evidência de portfólio)

Medidos durante a execução da Fase 7d, antes de fechar a fase.

### Bundle (build de produção)

- **Só code-splitting por rota** (Task 1): entry `index-*.js` ~**425 kB** (gzip ~135 kB),
  mais um chunk por rota lazy (a mais pesada, `contract-detail`, ~52 kB, carregada sob
  demanda).
- **+ vendor `manualChunks`** (Task 2): entry `src-*.js` caiu para ~**108 kB**
  (gzip ~32 kB); vendors separados em `react` ~190 kB (gzip ~60 kB) e `tanstack` ~118 kB
  (gzip ~37 kB), **ambos cacheáveis entre deploys**; chunks por rota seguem sob demanda.

### Lighthouse `/login` (preset `desktop`, mediana de 3 runs)

| categoria | score | orçamento asserido |
| --- | --- | --- |
| performance | **1.00** | ≥ 0.95 ✅ |
| accessibility | **1.00** | = 1.00 ✅ |
| best-practices | **0.96** | ≥ 0.95 ✅ |
| seo | **1.00** | = 1.00 ✅ |

Todas acima do orçamento de `apps/web/lighthouserc.json`.

## Medição manual de rota autenticada (FORA do gate)

Rotas autenticadas (ex.: **dashboard `/`**) **não entram no gate automatizado** porque
exigem uma **sessão logada** — o `vite preview` não tem backend nem cookie de sessão, e o
LHCI não faz login. Esse é um **passo manual**, best-effort; o gate automatizado cobre
o `/login` público e é o que trava o CI.

Para medir o dashboard manualmente:

1. Suba o stack local com backend de pé:
   - `docker compose up -d` (Postgres + MinIO),
   - `bun run --filter @quitto/api db:migrate`,
   - `bun run dev` (sobe api + web).
2. No Chrome, faça **login** (crie um usuário no `/login`) e navegue até o **dashboard**.
3. Abra **DevTools → Lighthouse**, escolha o modo **Navigation** + preset **Desktop**, e
   rode no dashboard já autenticado. (O modo Navigation recarrega a rota mantendo o cookie
   de sessão do perfil.)
4. Anote os scores como evidência. Não há gate quebrando por isto — é diagnóstico/portfólio.

> Por que não automatizar? Para medir o dashboard no CI seria preciso subir api+postgres+minio,
> semear um usuário e injetar o cookie de sessão no Lighthouse — toda a infra do job `e2e`,
> só para uma métrica de performance. O custo/fragilidade não compensa: o `/login` já exercita
> o mesmo bundle/CSS/fontes e é o caminho público de entrada. Fica como medição manual.

## Checklist rápido

- [ ] Job `lighthouse` separado do `verify`/`e2e` (paralelo ou `needs: verify`).
- [ ] **Sem** `services` (o `/login` é estático, não precisa de backend).
- [ ] Steps: checkout → setup-bun → install → `bun run --filter @quitto/web build` →
      `npx playwright install --with-deps chrome` → `cd apps/web && bunx lhci autorun`.
- [ ] Upload de `apps/web/.lighthouseci` (com `if: always()`, é evidência de portfólio).
- [ ] Build com **`bun run --filter @quitto/web build`** (forma nova do `--filter`).
- [ ] Lembrar: dashboard e demais rotas autenticadas são **medição manual**, fora do gate.
