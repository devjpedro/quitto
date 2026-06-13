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
| **5** | Notificações + lembretes | Notificações in-app, sininho, cron diário no Fly. | a escrever |
| **6** | Dashboard + PDF/export + LGPD | Visão geral, recibo/quitação PDF, export CSV/PDF, exportar dados/excluir conta. | a escrever |
| **7** | Polimento | A11y/WCAG 2.2 AA, Lighthouse 100, E2E Playwright dos fluxos críticos. | a escrever |

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
