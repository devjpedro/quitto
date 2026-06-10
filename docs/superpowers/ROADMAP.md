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
| **1** | Autenticação | Better Auth (Google + e-mail/senha) desacoplado, sessão, app shell (sidebar), login/logout, rota protegida. | a escrever |
| **2** | Contratos + Parcelas (core) | Modelo de domínio, gerar cronograma, valores variáveis, RBAC por papel, tela de contrato + drawer. Criar/ver contratos solo. | a escrever |
| **3** | Pagamento + comprovantes | Upload pré-assinado ao R2, máquina de estados (com/sem confirmação), trilha de auditoria. | a escrever |
| **4** | Participantes + convites | Contatos, link de convite, vínculo com usuário, acesso por papel. Compartilhar contrato. | a escrever |
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
