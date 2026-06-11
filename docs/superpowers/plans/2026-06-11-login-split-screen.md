# Login split-screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a tela de login/criação de conta como um split-screen de tela inteira — painel de marca teal (B2) à esquerda + formulário à direita — com tipografia de marca geométrica (Space Grotesk), preservando todo o comportamento de auth da Fase 1.

**Architecture:** O painel de marca vira um componente próprio (`AuthBrandPanel`) que recebe o `mode` e troca a frase. O `LoginPage` mantém exatamente os mesmos handlers/estado da Fase 1 e só reescreve o JSX para o layout split. A fonte é auto-hospedada via `@fontsource/space-grotesk` (empacotada pelo Vite, sem CDN), exposta como token `--font-display` no Tailwind v4. O gradiente do painel usa um novo token `--primary-strong` via uma classe utilitária `.bg-brand-panel`.

**Tech Stack:** React 19, Vite 8, Tailwind v4 (`@theme inline`), shadcn/ui (Button/Input/Label), Better Auth react client, `@fontsource/space-grotesk`.

> **Convenção de idioma (spec principal §9):** código/identificadores em inglês; texto visível ao usuário em pt-BR; docs/commits em pt-BR.

> **Nota sobre testes:** esta é uma mudança puramente apresentacional. O projeto `web` não tem harness de teste de componente (o único teste é o de tipos do Eden). A lógica de auth **não muda** (já coberta pela verificação e2e da Fase 1). Portanto a verificação é por **typecheck + build + lint + render visual** (screenshot headless), não por testes unitários — não invente testes frágeis de layout.

> **Pré-requisitos:** branch `feat/login-split-screen` (já criada a partir de `develop`). Spec: `docs/superpowers/specs/2026-06-11-login-split-screen-design.md`.

---

## Estrutura de arquivos (novos/alterados)

```
apps/web/
├─ package.json                          # + @fontsource/space-grotesk
├─ src/
│  ├─ main.tsx                           # importa os pesos da fonte (antes do index.css)
│  ├─ index.css                          # + --font-display, --primary-strong, .bg-brand-panel
│  ├─ components/
│  │  └─ auth-brand-panel.tsx            # NOVO — painel teal de marca (recebe mode)
│  └─ routes/
│     └─ login.tsx                       # reescrita do JSX (handlers idênticos); remove uso do Card
```

---

## Task 1: Fonte de marca (Space Grotesk) + tokens de tema

**Files:**
- Modify: `apps/web/package.json` (via `bun add`)
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Instalar a fonte auto-hospedada**

Run: `cd apps/web && bun add @fontsource/space-grotesk`
Expected: adiciona `@fontsource/space-grotesk` às `dependencies` do `apps/web/package.json` e atualiza `bun.lock`. (O pacote traz os arquivos woff2; o Vite os empacota no build — é self-hosted, sem CDN.)

- [ ] **Step 2: Importar os pesos da fonte no `main.tsx`**

Leia o `apps/web/src/main.tsx` atual. Adicione as duas importações de peso **imediatamente antes** da linha `import "./index.css";`. O topo do arquivo deve ficar:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./index.css";
import { queryClient } from "./lib/query";
import { router } from "./router";
```

(O restante do arquivo — o `createRoot(...).render(...)` — fica inalterado. Biome pode reordenar os imports; deixe o hook formatar.)

- [ ] **Step 3: Adicionar o token de fonte e o teal escuro no `index.css`**

Em `apps/web/src/index.css`, dentro do bloco `@theme inline { ... }`, adicione (logo após `--radius-sm`):

```css
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
```

Em `:root { ... }`, adicione (logo após a linha `--primary-foreground: ...;`):

```css
  --primary-strong: oklch(0.4 0.08 178);
```

- [ ] **Step 4: Adicionar a classe utilitária do gradiente do painel**

Ainda em `apps/web/src/index.css`, **crie um novo bloco** `@layer components` ao final do arquivo (depois do `@layer base` existente; não coloque dentro do `@layer base`):

```css
@layer components {
  .bg-brand-panel {
    background-image: linear-gradient(
      155deg,
      var(--primary) 0%,
      var(--primary-strong) 100%
    );
  }
}
```

- [ ] **Step 5: Typecheck + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build`
Expected: ambos PASS (exit 0). O build deve transformar os CSS da fonte (vão aparecer assets de fonte no `dist`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/main.tsx apps/web/src/index.css bun.lock
git commit -m "feat(web): fonte de marca Space Grotesk (auto-hospedada) + token de gradiente teal"
```

---

## Task 2: Componente `AuthBrandPanel` (painel teal de marca)

**Files:**
- Create: `apps/web/src/components/auth-brand-panel.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/auth-brand-panel.tsx`**

```tsx
type AuthMode = "signin" | "signup";

const PANEL_COPY: Record<AuthMode, { headline: string; sub: string }> = {
  signin: {
    headline: "Cada parcela no seu lugar.",
    sub: "Acompanhe contratos, comprovantes e quitações com clareza.",
  },
  signup: {
    headline: "Comece a quitar.",
    sub: "Crie sua conta e cadastre seu primeiro contrato em minutos.",
  },
};

export function AuthBrandPanel({ mode }: { mode: AuthMode }) {
  const copy = PANEL_COPY[mode];

  return (
    <aside className="bg-brand-panel relative flex flex-col overflow-hidden bg-primary px-8 py-8 text-primary-foreground md:w-[45%] md:px-12 md:py-14">
      {/* motivo decorativo (anéis) — só desktop, sem semântica */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        <span className="absolute -top-16 -right-12 h-52 w-52 rounded-full border border-white/15" />
        <span className="absolute -bottom-36 -left-20 h-80 w-80 rounded-full border border-white/15" />
        <span className="absolute top-24 left-10 h-24 w-24 rounded-full border border-white/10" />
      </div>

      <span className="font-display font-bold text-lg tracking-tight">
        ◷ Quitto
      </span>

      <div className="mt-auto">
        <h2 className="font-display font-bold text-3xl leading-[1.08] tracking-tight md:text-4xl">
          {copy.headline}
        </h2>
        <p className="mt-3 max-w-sm text-primary-foreground/80 text-sm md:mt-4">
          {copy.sub}
        </p>

        {/* chip de progresso ilustrativo (estático, decorativo) — só desktop */}
        <div
          aria-hidden="true"
          className="mt-6 hidden items-center gap-2 text-primary-foreground/90 text-xs md:flex"
        >
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full w-[62%] rounded-full bg-white/70" />
          </span>
          62% quitado
        </div>
      </div>
    </aside>
  );
}
```

> **Notas:** `bg-primary` é fallback caso a classe de gradiente não aplique. `text-primary-foreground` é o tom areia claro — alto contraste sobre o teal (atende AA). O `AuthMode` é local ao componente; o `LoginPage` usa o mesmo literal `"signin" | "signup"`. Biome vai ordenar classes/props — deixe o hook formatar.

- [ ] **Step 2: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS. (O componente ainda não é usado; só precisa compilar. Se o Biome reclamar de import não usado em outro lugar, ignore — este arquivo não importa nada.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth-brand-panel.tsx
git commit -m "feat(web): componente AuthBrandPanel (painel teal de marca)"
```

---

## Task 3: Reescrever `LoginPage` para o layout split-screen

**Files:**
- Modify: `apps/web/src/routes/login.tsx`

- [ ] **Step 1: Substituir o conteúdo de `apps/web/src/routes/login.tsx`**

Mantém **exatamente** o mesmo estado e o mesmo `handleSubmit` da Fase 1 (incluindo `try/finally`, limpeza de erro ao alternar modo, e o botão Google desabilitado em loading). Muda só os imports (remove `Card`, adiciona `AuthBrandPanel`) e o JSX retornado. Conteúdo completo do arquivo:

```tsx
import { type FormEvent, useState } from "react";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

function submitLabel(mode: "signin" | "signup") {
  return mode === "signin" ? "Entrar" : "Criar conta";
}

export function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const action =
      mode === "signin"
        ? signIn.email({ email, password, callbackURL: "/" })
        : signUp.email({ name, email, password, callbackURL: "/" });
    try {
      const { error: err } = await action;
      if (err) {
        setError(
          "Não foi possível entrar. Verifique os dados e tente novamente."
        );
        return;
      }
      window.location.href = "/";
    } catch {
      setError(
        "Não foi possível entrar. Verifique os dados e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <AuthBrandPanel mode={mode} />

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-10 md:px-10">
        <div className="w-full max-w-sm">
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
          </h1>
          <p className="mt-1 mb-6 text-muted-foreground text-sm">
            {mode === "signin"
              ? "Bem-vindo de volta ao Quitto."
              : "É rápido e grátis."}
          </p>

          <Button
            className="w-full"
            disabled={loading}
            onClick={() =>
              signIn.social({ provider: "google", callbackURL: "/" })
            }
            type="button"
            variant="outline"
          >
            Continuar com Google
          </Button>

          <div className="my-4 flex items-center gap-2 text-muted-foreground text-xs">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  required
                  value={name}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Aguarde..." : submitLabel(mode)}
            </Button>
          </form>

          <button
            className="mt-4 w-full text-center text-muted-foreground text-sm underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            type="button"
          >
            {mode === "signin"
              ? "Não tem conta? Cadastre-se"
              : "Já tem conta? Entre"}
          </button>
        </div>
      </div>
    </main>
  );
}
```

> **Atenção:** o `Card` deixou de ser importado/usado (era o contêiner central antigo). Não deixe o import órfão — o Biome/typecheck acusaria. A lógica de auth é byte-a-byte a mesma da Fase 1.

- [ ] **Step 2: Typecheck + build + lint**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build && bun --filter @quitto/web lint`
Expected: os três PASS (exit 0). Sem imports não usados, sem erro de tipo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/login.tsx
git commit -m "feat(web): login split-screen (painel de marca + formulário)"
```

---

## Task 4: Verificação visual (desktop + mobile) e fechamento

**Files:** (nenhum — verificação)

- [ ] **Step 1: Subir o web dev server**

Run (background): `bun --filter @quitto/web dev`
Aguarde aparecer `Local: http://localhost:3001/`. A rota `/login` é pública (sem guard), então **não precisa da API nem do Postgres** para renderizar.

- [ ] **Step 2: Screenshot desktop**

Localize o chromium headless (mesmo da verificação da Fase 1). Tente nesta ordem e use o primeiro que existir:
- `~/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`
- `chromium-browser` (no PATH)

Run (ajuste o caminho do binário):
```bash
CHROME=~/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1280,800 --screenshot=/tmp/login-desktop.png \
  http://localhost:3001/login
```
Depois **abra `/tmp/login-desktop.png` com a ferramenta Read** e confirme visualmente:
- split lado a lado: painel teal à esquerda (~45%), formulário à direita sobre areia;
- no painel: `◷ Quitto`, a frase "Cada parcela no seu lugar." em fonte geométrica (Space Grotesk), os anéis decorativos e o chip "62% quitado";
- formulário: título "Entre na sua conta", botão Google (outline), divisor "ou", campos E-mail/Senha, botão "Entrar" teal, link "Não tem conta? Cadastre-se".

- [ ] **Step 3: Screenshot mobile**

Run:
```bash
CHROME=~/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=390,844 --screenshot=/tmp/login-mobile.png \
  http://localhost:3001/login
```
**Read `/tmp/login-mobile.png`** e confirme: o painel teal vira uma faixa compacta no topo (logo + frase, sem os anéis/chip), e o formulário ocupa o restante da largura, legível e sem overflow horizontal.

- [ ] **Step 4: Conferir o branch "Criar conta" e contraste**

- No `login.tsx`, confirme por leitura que ao alternar para `signup` aparece o campo **Nome** e a frase do painel muda para "Comece a quitar." (via `AuthBrandPanel mode="signup"`).
- Confirme no screenshot desktop que o texto claro sobre o gradiente teal está nitidamente legível (contraste AA — texto areia ~branco sobre teal). Se algo estiver apagado, ajuste a opacidade do subtítulo (`text-primary-foreground/80` → `/90`) e re-screenshot.

- [ ] **Step 5: Encerrar o dev server**

Encerre o processo do `web dev` (mate a porta 3001).

- [ ] **Step 6: Suite do monorepo**

Run: `bun run lint && bun run typecheck && bun run build`
Expected: tudo verde. (Não precisa de Postgres para esses três; o `test` não foi alterado por esta fase, mas pode rodar `bun run test` se o Postgres estiver de pé.)

- [ ] **Step 7: Finalizar a branch**

Use a skill **superpowers:finishing-a-development-branch** para decidir a integração (merge `--no-ff` em `develop`, seguindo o padrão do projeto). Não há fase no ROADMAP para marcar (é melhoria de UI, não fase numerada).

---

## Self-Review (cobertura do spec)

- **Split-screen tela inteira, painel esquerda + form direita:** Task 3 ✅
- **Painel: logo + frase geométrica + motivo de anéis + chip de progresso:** Task 2 ✅
- **Tipografia Space Grotesk auto-hospedada, só display, corpo em sans do sistema:** Task 1 (token + import) + uso `font-display` nos títulos (Tasks 2 e 3) ✅
- **Comportamento de auth/erro/loading preservado da Fase 1:** Task 3 (handlers idênticos) ✅
- **Modo Entrar ⇄ Criar conta na mesma página + campo Nome + frase do painel muda:** Tasks 2 e 3 ✅
- **Responsivo (painel colapsa no mobile):** Tasks 2 (classes `md:`) e 3 (`flex-col md:flex-row`) + verificação Task 4 ✅
- **Acessibilidade (labels, foco, contraste AA, anéis/chip `aria-hidden`, decorativos):** Task 2 (`aria-hidden`) + Task 4 (contraste) ✅
- **Tokens: `--font-display`, `--primary-strong`, gradiente:** Task 1 ✅
- **`prefers-reduced-motion`:** não há animação/transição introduzida (motivo e chip são estáticos), então nada a desligar — requisito atendido por construção.
- **Verificação por build/typecheck/lint + render visual (sem testes frágeis):** Task 4 ✅
- **Fora de escopo (dark mode, outras telas, E2E Playwright):** respeitado ✅
