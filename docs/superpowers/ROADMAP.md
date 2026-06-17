# Quitto — Roadmap de implementação

O MVP foi fatiado em **fases sequenciais**, onde **cada fase entrega software funcionando e
testável por si só**. Cada fase tem seu próprio plano em `docs/superpowers/plans/`, escrito
**na hora de executá-la** (just-in-time) — assim cada plano reflete o que foi aprendido nas fases
anteriores.

Spec de referência: `docs/superpowers/specs/2026-06-09-quitto-design.md`.

## Fases

| # | Fase | Entrega testável ao fim | Plano |
|---|---|---|---|
| **0** | Fundações + spike do Eden | Monorepo (Bun+Turbo), `api`/`web`/`shared`, tooling, Drizzle+Postgres, health check, deploy configs, CI verde. Prova Eden+Better Auth tipando cross-package. | `plans/2026-06-09-fase-0-fundacoes.md` ✅ **concluído** (merge em `develop`; spike do Eden provado — tipo cruza o pacote sem virar `any`) |
| **1** | Autenticação | Better Auth (Google + e-mail/senha) desacoplado, sessão, app shell (sidebar), login/logout, rota protegida. | `plans/2026-06-10-fase-1-autenticacao.md` ✅ **concluído** (merge em `develop`; auth montado no app raiz com `/api/auth/*` resolvendo, `GET /api/me` protegida, login/logout e guard validados ponta a ponta) |
| **CD** | Deploy contínuo (aprendizado guiado) | GitHub Actions como dono do deploy: portão de testes + migrations no Neon + deploy orquestrado Fly→Vercel, ambientes e rollback. **Implementado pelo usuário; Claude atua como professor (não escreve o código).** | `guides/2026-06-10-cd-deploy-guia-estudo.md` (guia de estudo) |
| **2a** | Contratos + Parcelas (API + domínio) | Modelo de domínio (Contract/Installment/Participant), gerar cronograma (rateio + valores variáveis), progresso/atraso derivados, RBAC por contrato (404 sem vazar), endpoints REST (criar/listar/detalhar contrato, editar parcela). Sem UI. | `plans/2026-06-10-fase-2a-contratos-api.md` ✅ **concluído** (merge em `develop`; 30 testes verdes, Eden tipando os endpoints de contratos cross-package) |
| **2b** | Contratos + Parcelas (UI) | Lista de contratos (com progresso), wizard de criação (2 passos, auto/custom), tela de contrato (stats + progresso + parcelas) + drawer da parcela (editar valor/vencimento, owner). Fundação de erros (apiClient/ApiError, toasts, error boundary por rota), RHF+Zod, responsivo + bottom-nav. | `plans/2026-06-11-fase-2b-contratos-ui.md` ✅ **concluído** (merge em `develop`; 39 testes de UI verdes, Eden tipando ponta a ponta, identidade B2 via design skills) |
| **3a** | Pagamento + comprovantes (API) | Upload pré-assinado (S3/R2, MinIO em dev/CI), máquina de estados da parcela (com/sem confirmação) como função pura, trilha de auditoria append-only, RBAC por papel, presign/confirm/confirm-upload/dispute/mark-paid + GET detalhe (proofs assinados + timeline). Sem UI. | `plans/2026-06-11-fase-3a-pagamento-api.md` ✅ **concluído** (merge em `develop`; suite verde — 46 testes de API incl. storage/payments contra MinIO real, Eden tipando os endpoints de pagamento; CI exercita MinIO) |
| **3b** | Pagamento + comprovantes (UI) | Drawer da parcela: upload do comprovante (via URL pré-assinada), botões confirmar/contestar/marcar paga conforme papel, timeline da auditoria, badges de status. Consome os endpoints da 3a. | `plans/2026-06-11-fase-3b-pagamento-ui.md` ✅ **concluído** (merge em `develop`; suite verde — 70 testes de UI incl. matriz de ações/upload/diálogos/timeline, Eden tipando os endpoints de parcela cross-package; nome do ator na timeline deferido p/ Fase 4) |
| **4a** | Participantes + convites (API) | Owner adiciona/remove participantes; gera convite por link travado por e-mail (token de 256 bits, expira em 7d, uso único); convidado aceita vinculando-se ao slot (só se o e-mail da sessão bater) → acesso por papel via `getContractRole`. Nome do ator na timeline de auditoria (deferido da 3b). Sem UI. | `plans/2026-06-11-fase-4a-participantes-api.md` ✅ **concluído** (merge em `develop`; suite verde — API 66 testes incl. RBAC/no-leak/trava de e-mail/expiração/uso único, Eden tipando participantes/convites cross-package) |
| **4b** | Participantes + convites (UI) | Gerenciar participantes, gerar/copiar link de convite, tela de aceitar convite, exibir nome do ator na timeline. Consome os endpoints da 4a. | `plans/2026-06-12-fase-4b-participantes-ui.md` ✅ **concluído** (merge em `develop`; suite verde — API 69 testes + Web 94 testes incl. drawer de gestão/aceitar convite/banner de descoberta/timeline com ator, Eden tipando `invites.mine` cross-package; endurecido o login redirect contra open-redirect — same-origin only) |
| **4c** | Papéis dinâmicos + refino do gerenciamento | Capacidade de pagamento segue a vaga real (`isPayer`/`isApprover` separados de `isOwner`, dono herda o lado oposto só sem contraparte vinculada), badge mostra o papel do usuário logado, redesign do card de participante (campo "Papel" rotulado + ações em menu ⋯). | `plans/2026-06-13-fase-5-papeis-dinamicos.md` ✅ **concluído** (merge em `develop`; refino da série Participantes — o arquivo mantém o nome `fase-5` por histórico, mas a fase é 4c) |
| **5a** | Notificações + lembretes (API + cron) | Tabela `notification` (destinatário, tipo, ref contrato/parcela, `readAt`, `dedupeKey` único); gatilhos nos eventos de pagamento (comprovante→aprovador, confirmado/contestado→pagador, paga→contraparte); sweep puro `computeReminders` (vencendo em ≤3d / vencidas → pagador vinculado, disparo único via `dedupeKey`) invocado por Fly scheduled Machine; endpoints list/unread-count/mark-read escopados ao usuário. Sem UI. | `plans/2026-06-13-fase-5a-notificacoes-api.md` ✅ **concluído** (merge em `develop`; suite verde — gatilhos de pagamento, endpoints escopados ao usuário, sweep idempotente via dedupeKey, cron documentado no Fly) |
| **5b** | Notificações + lembretes (UI) | Sininho na topbar com contador de não-lidas (polling 60s), lista em popover com deep-link, rota `/notifications`, item na sidebar. Consome os endpoints da 5a. | `plans/2026-06-13-fase-5b-notificacoes-ui.md` ✅ **concluído** (merge em `develop`; suite verde — sininho com polling 60s, popover, rota `/notifications`, deep-link abrindo o drawer da parcela, badge na sidebar/bottom-nav; labels/ícones por tipo centralizados sem literais, `formatRelativeTimeBR`/`formatUnreadCount` compartilhados) |
| **6a** | Dashboard (visão geral) | A pagar/receber, atrasadas, contratos ativos, próximas parcelas com deep-link pro drawer. Endpoint de agregação `GET /api/dashboard`. | `plans/2026-06-13-fase-6a-dashboard.md` ✅ **concluído** (merge em `develop`; suite verde — `computeDashboard` puro + endpoint escopado ao usuário + página com stats/upcoming/empty state e deep-link, identidade B2) |
| **6b** | Recibo/quitação + export | Recibo/quitação em PDF, export CSV/PDF dos contratos/parcelas. | `plans/2026-06-13-fase-6b-documentos.md` ✅ **concluído** (merge em `develop`; suite verde — modelo puro + CSV + renderer pdfkit, endpoints recibo/extrato com RBAC e 409, download por âncora same-origin, layout B2) |
| **6c** | LGPD | Exportar dados do usuário, excluir conta. | `plans/2026-06-13-fase-6c-lgpd.md` ✅ **concluído** (merge em `develop`; suite verde — export JSON, exclusão com cascata + purga R2 best-effort, comprovante de terceiro preservado/anonimizado, frase de confirmação) |
| **7a** | Hardening de frontend | Sessão via `/api/me` cacheado (sem `getSession` por navegação, token não exposto ao JS), coerência de cache (`invalidateContractViews` em todas as escritas → dashboard sempre atualizado). | `plans/2026-06-13-fase-7a-frontend-hardening.md` ✅ **concluído** (merge em `develop`; suite verde — 154 testes web, typecheck/lint nos 3 pacotes) |
| **7b** | E2E (Playwright) | Testes ponta a ponta dos fluxos críticos (login, criar contrato, pagar/confirmar parcela, convite). | `plans/2026-06-14-fase-7b-e2e.md` ✅ **concluído** (merge em `develop`; suíte Playwright — 8 specs cobrindo auth, contratos, pagamento/confirmação/contestação, RBAC no-leak, convites incl. e-mail errado/já usado, notificações+deep-link, LGPD, dashboard; ambiente efêmero, seed via API real, sem endpoints de teste; job de CI documentado para a trilha CD) |
| **7c** | A11y/WCAG 2.2 AA | Auditoria e correções de acessibilidade nos fluxos principais. | `plans/2026-06-14-fase-7c-a11y.md` ✅ **concluído** (merge em `develop`; portão axe WCAG A/AA em todas as rotas no Playwright; main/skip-link/título por rota, erros de form associados, aria-current, rótulos de itens/popover/progress; foco ao gatilho restaurado no drawer/diálogos de pagamento com e2e de teclado; contraste de badges corrigido; checklist de teclado documentado) |
| **7d** | Performance / Lighthouse | Lighthouse 100, code-splitting, otimização de carregamento. | `plans/2026-06-14-fase-7d-performance.md` ✅ **concluído** (merge em `develop`; code-splitting por rota + vendor chunks, meta SEO/theme-color, font-display swap; orçamento Lighthouse asserido via `@lhci/cli` no `/login` (perf ≥0.95, a11y/seo 100); job de CI documentado para a trilha CD) |
| **7e** | UX polish (mobile) | Placeholders genéricos centralizados (`PLACEHOLDER`); responsivo a 320px (valor da parcela sem quebra, parcelas custom empilhadas, header de notificações, item de participante com wrap, padding mobile-first). | `plans/2026-06-14-fase-7e-ux-polish.md` ✅ **concluído** (merge em `develop`; suite verde — 157 testes web, typecheck/lint nos 3 pacotes) |
| **7f** | Excluir / sair de contrato | `DELETE /api/contracts/:id` (owner, cascata + purga R2 best-effort) e `DELETE /api/contracts/:id/me` (não-dono sai); menu de ações no detalhe com confirmação. | `plans/2026-06-14-fase-7f-excluir-sair-contrato.md` ✅ **concluído** (merge em `develop`; suites verdes — API 161 + web 161, typecheck/lint) |
| **7g** | Feedback de sucesso (toasts) | Toast de sucesso nas 13 ações de escrita via `mutation.meta.successMessage` (handler global `toastSuccessFromMeta` no `MutationCache.onSuccess` em `lib/query.ts`, simétrico ao `onError`), mensagens centralizadas em `lib/feedback.ts`. Sem mudança de API. | `plans/2026-06-14-fase-7g-feedback-toasts.md` ✅ **concluído** (merge em `develop`; suite verde — web 165 testes, typecheck/lint nos 3 pacotes) |

## Release / Produção

**v0.1.0 — publicada em produção (2026-06-16).** Smoke test validado ponta a ponta: signup
e-mail/senha, login Google, persistência de sessão, criar contrato, adicionar parcela, subir e
baixar comprovante (R2 via CORS).

- **Web:** https://usequitto.vercel.app (Vercel, SPA; deploy pré-buildado via CLI + Git conectado)
- **API:** https://usequitto-api.fly.dev (Fly, região `gru`, scale-to-zero)
- **Banco:** Neon (Postgres) · **Storage:** Cloudflare R2 (bucket privado, presigned) ·
  **Auth:** Better Auth (e-mail/senha + Google)
- **Topologia:** front same-origin → rewrite `/api` (vercel.json) → Fly; cookie first-party.
- **Guias:** `guides/2026-06-16-{r2-bucket-setup,neon-setup,google-oauth-prod,vercel-deploy}.md`.
- **Bugs corrigidos no 1º deploy:** Dockerfile não copiava `e2e/package.json` e copiava só o
  `node_modules` raiz (bun não hoista deps do workspace) → passou a instalar+rodar no mesmo stage;
  `vercel.json` sem fallback de SPA (reload em rota client dava 404) → catch-all `→ /index.html`.
- **Spec/plano:** `specs/2026-06-16-preparar-producao-design.md`, `plans/2026-06-16-preparar-producao.md`.

### CI/CD (GitHub Actions — `.github/workflows/ci.yml`)

**CI:** job `verify` (lint + typecheck + test + build) e job `e2e` (Playwright + axe), com Postgres
+ MinIO de serviço. Roda em push (`main`/`develop`) e PR. `concurrency` cancela runs obsoletos;
`permissions: contents: read`. (Imagem MinIO = `bitnamilegacy/minio:latest`; migração com
`bun run --filter`; vars `S3_*` declaradas no `env` da task `test` do Turbo pra os 16 testes de
storage não pularem.)

**CD (✅ no ar, 2026-06-16):** na `main`, gateado por `needs: [verify, e2e]` → `migrate` (Neon prod
via `PROD_DATABASE_URL`) → `deploy-api` (Fly, `flyctl deploy --remote-only`) ‖ `deploy-web` (Vercel
CLI prebuilt: `pull`/`build`/`deploy --prebuilt --prod`) → `smoke` (`/api/ping` + site). Segredos no
GitHub: `FLY_API_TOKEN`, `VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID`, `PROD_DATABASE_URL`. Vercel: Root
Directory = `apps/web`, "Ignored Build Step: Only build pre-production" (previews no Git, **produção
pelo pipeline** — sem deploy duplo). Primeiro CD verde de primeira.

Pendências menores / próximos: bumpar `actions/checkout@v4`→`v5` (Node 20 deprecado); avaliar gate de
**aprovação manual** de produção (GitHub Environment com required reviewers — Marco 5) e documentar
**rollback** (Fly releases / Vercel promote — Marco 6); quando adotar fluxo de PR, tirar `develop` do
trigger de push. **Cron de lembretes** (`guides/2026-06-13-cron-fly-lembretes.md`); backlog pós-MVP.

## Fluxo de execução de cada fase

1. **Escrever o plano** da fase (skill `superpowers:writing-plans`), JIT, baseado no spec + aprendizados.
2. **Isolar** o trabalho: branch/worktree dedicado (ex: `feat/fase-N-nome`).
3. **Executar** com `superpowers:subagent-driven-development` (um subagente por tarefa + review)
   ou `superpowers:executing-plans` (inline em lotes).
4. **Verificar** (`superpowers:verification-before-completion`): testes + lint + typecheck + smoke.
5. **Revisar** (`superpowers:requesting-code-review`) antes de fechar.
6. **Integrar** (`superpowers:finishing-a-development-branch`): merge/PR.
7. Atualizar este ROADMAP (marcar a fase) e seguir para a próxima.

## Notas
- Fase 0 carrega o maior risco técnico (spike Eden+Better Auth); por isso vem primeiro e isolada.
- Se o spike do Eden falhar, trocar para cliente tipado via OpenAPI antes da Fase 1 (ver fallback no plano da Fase 0).
- Backlog pós-MVP (recorrência/juros, OCR, pagamento real, multi-tenant, assinatura digital, push/e-mail, mobile) está no spec, seção de Escopo.
