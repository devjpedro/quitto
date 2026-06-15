# Marca / Wordmark Quitto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o "logo" atual (glifo unicode `◷` + texto) por um wordmark desenhado e reutilizável — a palavra `quitto` com o "o" final como anel de progresso teal — aplicado na sidebar (clicável → início), no login e como favicon.

**Architecture:** Um componente apresentacional `Logo` (texto `quitt` + `<LogoMark>` inline) com duas variantes de cor (`brand`/`inverted`); geometria e cores centralizadas em constantes nomeadas (sem números mágicos). A navegação é responsabilidade do consumidor: na sidebar o `Logo` é embrulhado num `<Link to="/">`. Favicon é um SVG estático espelhando o `LogoMark`.

**Tech Stack:** React 19, TanStack Router, Tailwind v4, Vitest + jsdom + Testing Library, Space Grotesk (`--font-display`, já com `font-display: swap`).

**Spec:** `docs/superpowers/specs/2026-06-15-marca-wordmark-design.md`

**Git:** branch `feat/marca-wordmark` a partir de `develop`; commit por tarefa; ao fim, tudo verde → merge em `develop`.

---

## Estrutura de arquivos

- **Criar** `apps/web/src/components/logo.tsx` — `Logo` + `LogoMark` + constantes (geometria, cores por variante, proporções do wordmark). Única responsabilidade: desenhar a marca.
- **Criar** `apps/web/public/favicon.svg` — SVG estático do anel sobre tile teal.
- **Modificar** `apps/web/src/components/app-sidebar.tsx` — troca o `<span>◷ Quitto</span>` por `<Link to="/"><Logo variant="brand" /></Link>`.
- **Modificar** `apps/web/src/components/auth-brand-panel.tsx` — troca o `<span>◷ Quitto</span>` por `<Logo variant="inverted" />`.
- **Modificar** `apps/web/index.html` — adiciona `<link rel="icon">` apontando pro favicon.
- **Criar** `apps/web/tests/logo.test.tsx`, `apps/web/tests/app-sidebar-logo.test.tsx`, `apps/web/tests/auth-brand-panel.test.tsx`.

**Decisão de favicon:** o spec dizia "anel teal sobre transparente". Refino aqui pra **tile teal arredondado + anel branco** — lê melhor a 16px e funciona tanto em abas claras quanto escuras, casando com o `theme-color` teal. (Sinalizar ao usuário no handoff.)

---

### Task 1: Componente `Logo` + `LogoMark`

**Files:**
- Create: `apps/web/src/components/logo.tsx`
- Test: `apps/web/tests/logo.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/tests/logo.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo, LogoMark } from "../src/components/logo";

describe("Logo", () => {
  it("exposes a single labelled image named Quitto", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });

  it("hides the inner wordmark text from assistive tech", () => {
    render(<Logo />);
    expect(screen.getByText("quitt")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the teal arc for the brand variant", () => {
    const { container } = render(<Logo variant="brand" />);
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("stroke", "#0f766e");
  });

  it("uses the white arc for the inverted variant", () => {
    const { container } = render(<Logo variant="inverted" />);
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("stroke", "#ffffff");
  });
});

describe("LogoMark", () => {
  it("renders the ring hidden from assistive tech (decorative)", () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd apps/web && bun run test logo.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/components/logo"`.

- [ ] **Step 3: Implementar `logo.tsx`**

```tsx
// apps/web/src/components/logo.tsx
import type { CSSProperties } from "react";

type LogoVariant = "brand" | "inverted";

const RING = {
  box: 24,
  center: 12,
  radius: 9,
  strokeWidth: 4,
  // ~70% do anel fechado (circunferência ≈ 56.5)
  dashArray: "40 57",
  // gira a abertura pro canto inferior-direito (relógio quase cheio)
  rotation: 125,
} as const;

const RING_COLORS: Record<LogoVariant, { track: string; arc: string }> = {
  brand: { track: "#cfe8e2", arc: "#0f766e" },
  inverted: { track: "rgba(255,255,255,0.35)", arc: "#ffffff" },
};

// cor do texto do wordmark por variante; inverted herda currentColor (branco do painel)
const TEXT_COLOR: Record<LogoVariant, string> = {
  brand: "text-primary",
  inverted: "",
};

const WORDMARK = {
  defaultSize: 20,
  // diâmetro do anel como fração do font-size (casa com o tamanho do "o")
  ringToFontRatio: 0.72,
  // empurrão vertical (× font-size) pro anel assentar na linha de base
  baselineShiftRatio: -0.13,
} as const;

export function LogoMark({
  size = WORDMARK.defaultSize,
  variant = "brand",
  style,
}: {
  size?: number;
  variant?: LogoVariant;
  style?: CSSProperties;
}) {
  const { track, arc } = RING_COLORS[variant];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      style={style}
      viewBox={`0 0 ${RING.box} ${RING.box}`}
      width={size}
    >
      <circle
        cx={RING.center}
        cy={RING.center}
        fill="none"
        r={RING.radius}
        stroke={track}
        strokeWidth={RING.strokeWidth}
      />
      <circle
        cx={RING.center}
        cy={RING.center}
        fill="none"
        r={RING.radius}
        stroke={arc}
        strokeDasharray={RING.dashArray}
        strokeLinecap="round"
        strokeWidth={RING.strokeWidth}
        transform={`rotate(${RING.rotation} ${RING.center} ${RING.center})`}
      />
    </svg>
  );
}

export function Logo({
  size = WORDMARK.defaultSize,
  variant = "brand",
}: {
  size?: number;
  variant?: LogoVariant;
}) {
  const className = [
    "select-none font-bold font-display tracking-tight",
    TEXT_COLOR[variant],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-label="Quitto"
      className={className}
      role="img"
      style={{ fontSize: size, whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true">quitt</span>
      <LogoMark
        size={Math.round(size * WORDMARK.ringToFontRatio)}
        style={{
          marginLeft: 1,
          verticalAlign: size * WORDMARK.baselineShiftRatio,
        }}
        variant={variant}
      />
    </span>
  );
}
```

Nota: o `<span>` é inline (não flex) de propósito — assim o `vertical-align` do SVG funciona. O `baselineShiftRatio` é um valor de partida; conferir a olho no Step 4 da Task 2/3 e ajustar se o anel ficar alto/baixo demais.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd apps/web && bun run test logo.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/logo.tsx apps/web/tests/logo.test.tsx
git commit -m "feat(web): componente Logo/LogoMark (wordmark com anel)"
```

---

### Task 2: Aplicar na sidebar com link pro início

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx:42-44`
- Test: `apps/web/tests/app-sidebar-logo.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/tests/app-sidebar-logo.test.tsx
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({ data: { id: "u1", name: "Maria", email: "m@e.com" } }),
}));
vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: () => ({ data: { count: 0 } }),
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => null,
}));

import { AppSidebar } from "../src/components/app-sidebar";

function renderSidebarAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <AppSidebar />
        <Outlet />
      </>
    ),
  });
  rootRoute.addChildren(
    ["/", "/contracts", "/notifications", "/settings"].map((p) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path: p,
        component: () => null,
      })
    )
  );
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("AppSidebar brand logo", () => {
  it("renders the logo as a link to home", async () => {
    renderSidebarAt("/contracts");
    const home = await screen.findByRole("link", { name: "Ir para o início" });
    expect(home).toHaveAttribute("href", "/");
  });

  it("shows the Quitto wordmark inside that link", async () => {
    renderSidebarAt("/contracts");
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && bun run test app-sidebar-logo.test.tsx`
Expected: FAIL — não existe link "Ir para o início" (a sidebar ainda mostra `◷ Quitto` num `<span>`).

- [ ] **Step 3: Aplicar a mudança**

No topo do arquivo, adicionar o import (a linha do `Link` já existe):

```tsx
import { Logo } from "@/components/logo";
```

Substituir o bloco atual (linhas ~42-44):

```tsx
          <span className="select-none font-extrabold text-lg text-primary tracking-tight">
            ◷ Quitto
          </span>
```

por:

```tsx
          <Link
            aria-label="Ir para o início"
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/"
          >
            <Logo size={20} variant="brand" />
          </Link>
```

- [ ] **Step 4: Rodar os testes e confirmar que passam (sem regressão)**

Run: `cd apps/web && bun run test app-sidebar`
Expected: PASS — `app-sidebar-logo`, `app-sidebar` e `app-sidebar-active-link` todos verdes.

Conferência visual (opcional, recomendada): `bun run dev` e olhar a sidebar — o anel deve assentar na linha de base do `quitt`; ajustar `WORDMARK.baselineShiftRatio` em `logo.tsx` se necessário.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/tests/app-sidebar-logo.test.tsx
git commit -m "feat(web): wordmark clicável (→ início) na sidebar"
```

---

### Task 3: Aplicar no painel de login (variante invertida)

**Files:**
- Modify: `apps/web/src/components/auth-brand-panel.tsx:29-31`
- Test: `apps/web/tests/auth-brand-panel.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
// apps/web/tests/auth-brand-panel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthBrandPanel } from "../src/components/auth-brand-panel";

describe("AuthBrandPanel", () => {
  it("shows the Quitto wordmark", () => {
    render(<AuthBrandPanel mode="signin" />);
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });

  it("keeps the brand mark non-interactive (no link)", () => {
    render(<AuthBrandPanel mode="signin" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && bun run test auth-brand-panel.test.tsx`
Expected: FAIL — não há `role="img"` com nome "Quitto" (ainda é `◷ Quitto` em `<span>`).

- [ ] **Step 3: Aplicar a mudança**

No topo do arquivo, adicionar:

```tsx
import { Logo } from "@/components/logo";
```

Substituir (linhas ~29-31):

```tsx
      <span className="font-bold font-display text-lg tracking-tight">
        ◷ Quitto
      </span>
```

por:

```tsx
      <Logo size={20} variant="inverted" />
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/web && bun run test auth-brand-panel.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/auth-brand-panel.tsx apps/web/tests/auth-brand-panel.test.tsx
git commit -m "feat(web): wordmark invertido no painel de login"
```

---

### Task 4: Favicon SVG + link no index.html

**Files:**
- Create: `apps/web/public/favicon.svg`
- Modify: `apps/web/index.html:8`

- [ ] **Step 1: Criar o favicon**

```xml
<!-- apps/web/public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0f766e" />
  <circle cx="16" cy="16" r="9" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="4" />
  <circle cx="16" cy="16" r="9" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="40 57" transform="rotate(125 16 16)" />
</svg>
```

- [ ] **Step 2: Referenciar no `index.html`**

Adicionar, logo após a linha do `<title>` (linha 8):

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 3: Verificar que o build inclui o favicon**

Run: `cd apps/web && bun run build`
Expected: build OK; `dist/favicon.svg` existe (`ls dist/favicon.svg`) e `dist/index.html` contém `rel="icon"` (`grep "rel=\"icon\"" dist/index.html`).

Conferência visual (opcional): `bun run preview` e ver o ícone na aba do navegador.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/favicon.svg apps/web/index.html
git commit -m "feat(web): favicon SVG (anel da marca)"
```

---

### Task 5: Verificação final + merge

**Files:** nenhum (gate de qualidade).

- [ ] **Step 1: Suíte web completa + typecheck + lint**

Run: `cd apps/web && bun run test`
Expected: tudo verde (inclui os novos `logo`, `app-sidebar-logo`, `auth-brand-panel` e os existentes de sidebar).

Run (na raiz): `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 2: a11y E2E (opcional — exige docker)**

Se o ambiente local tiver docker: `docker compose up -d` e `bun run e2e specs/a11y.spec.ts`.
Expected: zero violações axe — a marca virou imagem rotulada (`role="img"`/`aria-label`), o `/login` segue limpo. (Se docker não estiver disponível, registrar que ficou para o job de CI.)

- [ ] **Step 3: Garantir que o glifo antigo sumiu**

Run: `grep -rn "◷" apps/web/src apps/web/index.html`
Expected: nenhum resultado.

- [ ] **Step 4: Merge em develop**

```bash
git checkout develop
git merge --no-ff feat/marca-wordmark -m "feat(web): nova marca/wordmark Quitto (anel de progresso)"
```

---

## Self-review

- **Cobertura do spec:** componente apresentacional `Logo`/`LogoMark` (Task 1); caixa minúscula no logotipo + "Quitto" no `aria-label`/título (Task 1, copy intocada); clique→início só na sidebar (Task 2), login não-clicável (Task 3); variantes `brand`/`inverted` (Task 1, validadas nas Tasks 2/3); favicon = anel (Task 4); fonte via `font-display` (Task 1); testes Vitest cobrindo role/label/variante/link (Tasks 1-3); glifo antigo removido (Task 5 Step 3). ✔
- **Placeholders:** nenhum — todo passo tem código/comando concreto. O `baselineShiftRatio` é valor concreto com nota de ajuste visual (não é placeholder). ✔
- **Consistência de tipos:** `LogoVariant`, props `size`/`variant`/`style`, `Logo`/`LogoMark` idênticos entre tasks; `RING`/`RING_COLORS`/`WORDMARK`/`TEXT_COLOR` usados como definidos. ✔
- **Desvio sinalizado:** favicon vira tile teal + anel branco (melhor legibilidade a 16px) — comunicar no handoff. ✔
