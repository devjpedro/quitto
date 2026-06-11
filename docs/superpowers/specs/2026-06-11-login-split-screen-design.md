# Login split-screen — Design

> **Status:** design aprovado em brainstorming, aguardando revisão final.
> **Data:** 2026-06-11
> **Escopo:** redesign da tela de login/criação de conta (Fase 1 já entregue um login funcional com card central; esta é uma melhoria visual).

## 1. Objetivo

Substituir o login atual (card central simples) por um layout **split-screen de tela inteira**: painel
de marca teal à esquerda, formulário à direita. Mais marcante e alinhado à identidade **B2**, sem
perder nada do comportamento funcional já validado na Fase 1 (Google + e-mail/senha, tratamento de
erro, guard de rota).

Não-objetivos: mudar o fluxo de auth, as rotas, ou qualquer coisa fora da tela de login.

## 2. Direção visual (aprovada)

- **Estrutura:** duas metades de tela cheia (`min-h-screen`). Painel de marca à **esquerda**,
  formulário à **direita**.
- **Painel (esquerda):** fundo em **gradiente teal** (`#0f766e` → tom mais escuro), texto claro.
  Contém:
  - marca `◷ Quitto` no topo;
  - **frase de impacto** grande em tipografia geométrica (ver §3) — login: *"Cada parcela no seu
    lugar."*; criar conta: *"Comece a quitar."*;
  - subtítulo curto de apoio;
  - **motivo gráfico**: anéis concêntricos abstratos (remetem a progresso/quitação), puramente
    decorativos;
  - **chip de progresso** discreto ("62% quitado" com mini barra) — elemento ilustrativo estático,
    sem dados reais.
- **Formulário (direita):** fundo areia (`--background`), centralizado verticalmente. Botão
  "Continuar com Google" (outline), divisor "ou", campos e botão primário teal. Reusa os
  componentes shadcn já existentes (`Button`, `Input`, `Label`; `Card` deixa de ser usado como
  contêiner central).
- **Sem fotos/stock images** — a identidade vem da cor, tipografia e do motivo gráfico (evita a
  "cara de IA genérica" que o spec principal §5 proíbe).

## 3. Tipografia de marca

- Introduzir **uma** fonte display geométrica para marca/títulos: **Space Grotesk** (decisão;
  alternativas consideradas: Geist, Inter Tight).
- **Auto-hospedada** (arquivos de fonte no projeto, via `@font-face`), não via CDN do Google —
  para não criar dependência de terceiros nem custo de carregamento externo (meta Lighthouse do
  spec principal §6). Carregar apenas os pesos usados (ex.: 500/700) com `font-display: swap`.
- **Uso:** títulos de marca e a frase de impacto do painel. O **corpo e os campos do formulário
  continuam na sans do sistema** (sem fonte de corpo nova) para manter o carregamento enxuto.
- Exposta como token/utilitário no `index.css` (ex.: variável `--font-display` + uma classe
  `font-display`), para o app reusar em títulos no futuro.

## 4. Comportamento (inalterado da Fase 1, preservar)

- Modos **Entrar ⇄ Criar conta** alternados **na mesma página** (estado local, sem trocar de rota).
  "Criar conta" adiciona o campo **Nome** e troca a frase do painel.
- Submit chama `signIn.email` / `signUp.email` com `callbackURL: "/"`; em sucesso vai para `/`.
- Google: `signIn.social({ provider: "google", callbackURL: "/" })`.
- **Tratamento de erro e loading** já corrigidos na Fase 1 são mantidos: `try/finally` reseta o
  loading mesmo em erro de rede; erro é limpo ao alternar de modo; botão Google desabilitado
  durante submit; mensagem de erro em pt-BR.
- Textos visíveis em **pt-BR**; identificadores/código em inglês (convenção do spec principal §9).

## 5. Responsivo

- **Desktop (≥ md):** split 50/50 (ou ~45/55 a favor do formulário), as duas metades visíveis.
- **Mobile (< md):** o painel teal **colapsa numa faixa compacta no topo** (logo + frase curta) e o
  formulário ocupa o resto da tela. O motivo de anéis e o chip de progresso podem ser ocultados no
  mobile para não competir com o formulário.

## 6. Acessibilidade (manter padrão da Fase 1 + WCAG 2.2 AA)

- `<label htmlFor>` ligado a cada input; `<main>` como landmark.
- **Contraste AA** do texto claro sobre o gradiente teal (verificar o tom mais claro do gradiente).
- Motivo de anéis e chip ilustrativo marcados como **decorativos** (`aria-hidden`).
- **Foco visível** em todos os controles; ordem de tabulação natural (formulário focável primeiro
  no fluxo de leitura).
- Respeitar **`prefers-reduced-motion`** (se houver qualquer transição/animação sutil de entrada,
  desligá-la).

## 7. Tema / tokens

- Tokens B2 existentes em `apps/web/src/index.css` permanecem; o gradiente do painel usa o
  `--primary` (teal) e uma variação mais escura (pode ser um novo token, ex.: `--primary-strong`,
  ou um `color-mix`/gradiente derivado de `--primary`).
- Adicionar `--font-display` (Space Grotesk) e mapear no `@theme inline`.

## 8. Arquivos afetados (previsão; o plano detalha)

- `apps/web/src/routes/login.tsx` — reescrita do layout (mesma lógica/handlers; nova estrutura
  split + painel). Possível extração de um subcomponente do painel (`AuthBrandPanel`) se o arquivo
  crescer demais — decisão no plano.
- `apps/web/src/index.css` — `@font-face` da Space Grotesk, `--font-display`, eventual
  `--primary-strong`.
- `apps/web/src/assets/fonts/` (novo) — arquivos da fonte auto-hospedada (woff2).
- Sem mudanças em rotas, API, ou outros componentes.

## 9. Verificação

- `bun --filter @quitto/web typecheck` + `build` verdes (a fonte deve ser empacotada pelo Vite).
- `bun run lint` (Biome) verde.
- Verificação visual: render do `/login` (desktop e largura mobile) — login e criar conta;
  confirmar split, painel teal, fonte de marca aplicada, e que o fluxo de auth continua funcionando
  (reusar a verificação e2e por proxy/headless da Fase 1).
- Conferir contraste do texto sobre o gradiente.

## 10. Fora de escopo

- E2E Playwright (Fase 7), tema dark, qualquer outra tela do app, mudança no app shell/sidebar.
