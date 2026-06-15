# Fase 7d — Performance / Lighthouse 100 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Reduzir o bundle inicial (code-splitting de rotas + vendor chunks) e instalar um portão de orçamento Lighthouse (`@lhci/cli`) que prova/garante os scores. Última fatia do MVP.

**Architecture:** Rotas viram `lazyRouteComponent` (login/shell eager); Vite separa vendor via `manualChunks`; `@lhci/cli` audita o `/login` no `vite preview` com orçamento asserido. Loaders mantidos. Job de CI documentado (trilha CD do usuário).

**Tech Stack:** React 19 + Vite, TanStack Router (code-based), `@lhci/cli`, `rollup-plugin-visualizer`.

**Spec:** `docs/superpowers/specs/2026-06-14-fase-7d-performance-design.md`

**Git:** branch `feat/fase-7d-performance` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 7d no ROADMAP (fecha a Fase 7 / o MVP).

**Convenções:** código em inglês; sem mudança de comportamento (só carregamento/build).

---

## Task 1: Code-splitting de rotas

**Files:** Modify `apps/web/src/router.tsx`

- [ ] **Step 1: Converter as rotas protegidas para lazy**

Em `router.tsx`:
1. importe `lazyRouteComponent` do `@tanstack/react-router`.
2. **Remova** os imports estáticos das 7 páginas internas (`AcceptInvitePage`, `ContractDetailPage`,
   `ContractNewPage`, `ContractsListPage`, `DashboardPage`, `NotificationsPage`, `SettingsPage`).
   **Mantenha** `LoginPage`, `protectedRoute`, `rootRoute` e os imports de `queryOptions`/`queryClient`.
3. em cada rota protegida, troque `component: XPage` por
   `component: lazyRouteComponent(() => import("./routes/<arquivo>"), "<ExportName>")`:

```ts
// dashboard
component: lazyRouteComponent(() => import("./routes/dashboard"), "DashboardPage"),
// contracts list
component: lazyRouteComponent(() => import("./routes/contracts-list"), "ContractsListPage"),
// contract new
component: lazyRouteComponent(() => import("./routes/contract-new"), "ContractNewPage"),
// contract detail
component: lazyRouteComponent(() => import("./routes/contract-detail"), "ContractDetailPage"),
// notifications
component: lazyRouteComponent(() => import("./routes/notifications"), "NotificationsPage"),
// settings
component: lazyRouteComponent(() => import("./routes/settings"), "SettingsPage"),
// accept invite
component: lazyRouteComponent(() => import("./routes/accept-invite"), "AcceptInvitePage"),
```

`loginRoute` continua `component: LoginPage` (eager — primeira pintura pública). Os `loader`s e
`validateSearch` ficam inalterados.

- [ ] **Step 2: Typecheck + testes web**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: PASS (os testes de página importam os componentes diretamente, não via router — não
são afetados).

- [ ] **Step 3: Build prova o split**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun run build`
Expected: `dist/assets/` agora tem **vários chunks** (um por rota lazy) em vez de um único
`index-*.js` gigante. Confira que o chunk de entrada encolheu bem.

- [ ] **Step 4: Commit** (`perf(web): code-splitting das rotas protegidas (lazyRouteComponent)`)

---

## Task 2: Vendor chunks + analisador de bundle

**Files:** Modify `apps/web/vite.config.ts`, `apps/web/package.json`

- [ ] **Step 1: Instalar o visualizer**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun add -d rollup-plugin-visualizer`

- [ ] **Step 2: Configurar `vite.config.ts`**

```ts
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type PluginOption } from "vite";

const analyze = process.env.ANALYZE === "1";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(analyze
      ? [visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true }) as PluginOption]
      : []),
  ],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  server: {
    port: 3001,
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          tanstack: ["@tanstack/react-query", "@tanstack/react-router"],
        },
      },
    },
  },
});
```

- [ ] **Step 3: Script `build:analyze`**

Em `apps/web/package.json` scripts, adicione: `"build:analyze": "ANALYZE=1 vite build"`.

- [ ] **Step 4: Validar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun run build:analyze`
Expected: build verde; gera `dist/stats.html`; saída mostra os chunks `react`, `tanstack` e os
por-rota separados do entry. (Anote o tamanho do entry para o guia.)

- [ ] **Step 5: Commit** (`perf(web): manualChunks (vendor) + analisador de bundle`)

---

## Task 3: `index.html` (SEO/meta) + fontes

**Files:** Modify `apps/web/index.html`, `apps/web/src/index.css` (se preciso p/ font-display)

- [ ] **Step 1: Metatags em `index.html`**

No `<head>`, adicione:
```html
<meta name="description" content="Quitto — gerencie contratos parcelados, comprovantes e quitação em um só lugar." />
<meta name="theme-color" content="#0f766e" />
```
(Mantém `lang="pt-BR"` e o `<title>` — os títulos por rota da 7c cuidam do resto do SEO.)

- [ ] **Step 2: Fontes — `font-display: swap` (best-effort, baixo risco)**

Confira se o `@fontsource/space-grotesk/500.css` já traz `font-display: swap`:
Run: `grep -i "font-display" /home/buckz/Documentos/www/personal-projects/quitto/node_modules/@fontsource/space-grotesk/500.css`
- **Se já houver `swap`:** nada a fazer (só siga).
- **Se não houver:** Space Grotesk é display-only (títulos), impacto de LCP baixo. Garanta o swap
  declarando um `@font-face` próprio em `index.css` com `font-display: swap` para as weights 500/700
  (apontando para os `.woff2` do pacote via `url()` resolvido pelo Vite), e **remova** os imports
  `@fontsource/.../500.css` e `700.css` do `main.tsx`. Mantenha o `--font-display` no `index.css`.
  (Se o `@font-face` manual ficar arriscado/fragil, deixe os imports do fontsource como estão — o
  ganho aqui é marginal e não bloqueia o orçamento.)

- [ ] **Step 3: Build + typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun run build`
Expected: build verde.

- [ ] **Step 4: Commit** (`perf(web): meta description/theme-color + font-display swap`)

---

## Task 4: Orçamento Lighthouse (lhci)

**Files:** Create `apps/web/lighthouserc.json`; Modify `apps/web/package.json`

- [ ] **Step 1: Instalar lhci**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun add -d @lhci/cli`

- [ ] **Step 2: `apps/web/lighthouserc.json`**

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "bunx vite preview --port 4173",
      "url": ["http://localhost:4173/login"],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 1 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```

- [ ] **Step 3: Script `lh`**

Em `apps/web/package.json` scripts: `"lh": "vite build && lhci autorun"`. Adicione `.lighthouseci`
ao `.gitignore` do `apps/web` (ou raiz).

- [ ] **Step 4: Rodar e bater o orçamento**

O lhci precisa de um Chrome real. Se não houver Google Chrome no sistema, instale-o via Playwright
e aponte `CHROME_PATH`:
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx playwright install chrome`
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bun run lh`
Expected: build → preview → 3 execuções no `/login` → **assert verde** (perf ≥0.95, a11y=1,
bp≥0.95, seo=1). Se algo ficar abaixo, ajuste na origem (ex.: best-practices costuma cair por
console errors/HTTPS — no preview local o HTTPS não conta; foque em perf/seo/a11y) e use
`superpowers:systematic-debugging` se um item não estiver óbvio. Registre os scores no guia.

- [ ] **Step 5: Commit** (`perf(web): orçamento Lighthouse via @lhci/cli (/login)`)

---

## Task 5: Verificação final + guia de CI + roadmap + merge

**Files:** Create `docs/superpowers/guides/2026-06-14-lighthouse-ci-job.md`; Modify `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Regressão — suítes existentes**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Run (com pg+minio de pé): `cd /home/buckz/Documentos/www/personal-projects/quitto/e2e && bun run e2e`
Expected: tudo verde — o code-splitting não muda comportamento; os specs E2E (incl. `a11y.spec`)
seguem passando (as rotas lazy resolvem antes dos asserts de visibilidade).

- [ ] **Step 2: Guia do job de Lighthouse no CI** (material de estudo — Claude ensina, não escreve o YAML)

Crie `docs/superpowers/guides/2026-06-14-lighthouse-ci-job.md`: como rodar `lhci autorun` num job
(separado do `verify`): `bun install` → `bun --filter @quitto/web run build` → instalar Chrome
(`bunx playwright install chrome` ou `lhci`'s chrome) → `cd apps/web && bunx lhci autorun`;
publicar o relatório como artefato; o `/login` não precisa de backend. Registre também os números
medidos (antes/depois do entry chunk; scores Lighthouse) como evidência de portfólio.

- [ ] **Step 3: Lighthouse manual numa rota autenticada**

Com `bun run dev` + login, rode o Lighthouse do Chrome no dashboard e anote os scores no guia
(rotas autenticadas ficam fora do gate automatizado por exigirem sessão).

- [ ] **Step 4: Marcar a 7d no ROADMAP (fecha a Fase 7 / MVP)**

Troque a célula da linha **7d** de `a escrever` para:
`` `plans/2026-06-14-fase-7d-performance.md` ✅ **concluído** (merge em `develop`; code-splitting por rota + vendor chunks, meta SEO/theme-color, font-display swap; orçamento Lighthouse asserido via `@lhci/cli` no `/login` (perf ≥0.95, a11y/seo 100); job de CI documentado para a trilha CD) ``

- [ ] **Step 5: Commit + merge**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/guides/2026-06-14-lighthouse-ci-job.md docs/superpowers/ROADMAP.md
git commit -m "docs: guia do job de Lighthouse + marca Fase 7d (MVP completo)"
git checkout develop
git merge --no-ff feat/fase-7d-performance -m "Merge: Fase 7d — performance / Lighthouse 100"
```

---

## Notas para o executor

- **Sem mudança de comportamento:** 7d é só carregamento/build. Se algum teste/spec quebrar, é
  efeito colateral do split — investigue (lazy resolve antes do render; `expect.toBeVisible()`
  espera).
- **Eager x lazy:** só `LoginPage`/`ProtectedLayout`/`rootRoute` ficam eager; o resto é `import()`
  dinâmico. Não torne o login lazy (é a primeira pintura pública).
- **lhci precisa de Chrome real** (não o chromium do Playwright headless do e2e necessariamente —
  use `bunx playwright install chrome` que instala o Google Chrome, ou aponte `CHROME_PATH`).
- **Alvo do gate = `/login`** (público, sem backend). Rotas autenticadas: Lighthouse manual
  documentado.
- **Não toque em `.github/workflows`** — o job de Lighthouse é do usuário (trilha CD).
- **`manualChunks`:** mantenha enxuto (react + tanstack). Não micro-otimize chunk a chunk sem o
  visualizer apontar necessidade.
