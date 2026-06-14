# Fase 7b — E2E (Playwright)

**Data:** 2026-06-14
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§10 testes — "E2E (Playwright): fluxos críticos")

Fatia de polimento (Fase 7). Adiciona testes ponta a ponta cobrindo os fluxos críticos **e**
casos não-convencionais (RBAC/estado/convite), sobre o app que já existe.

## Princípio de cobertura

E2E cobre **jornadas reais** + **casos de borda cross-camada** que só aparecem com o stack de pé
(cookie de sessão real, upload real no MinIO, RBAC entre 2 usuários, deep-links). **Não** duplica
no E2E a matriz exaustiva de unidade/integração (~322 testes já cobrem cada transição de estado e
validação) — replicar isso no E2E seria lento e frágil. E2E caracteriza o comportamento existente:
se um teste falhar, é bug real ou seletor — investigar (não é TDD red-green de feature nova).

## Harness

- **Pacote dedicado `e2e/`** no workspace (próprio `package.json` + `@playwright/test`), isolado
  do Vitest do web.
- **`playwright.config.ts`**: `baseURL http://localhost:3001`; `webServer` sobe **api (3000)** e
  **web (3001)** antes da suíte (reusa `bun run dev` de cada app, `reuseExistingServer` em dev);
  projeto Chromium; `trace: "on-first-retry"`.
- **Serviços (Postgres + MinIO):** novo **`docker-compose.yml`** na raiz (Postgres 16 + MinIO com
  bucket `quitto-proofs`), servindo dev local **e** E2E local. O `webServer` assume os serviços de
  pé (o script `e2e` documenta `docker compose up -d` antes).
- **Env:** o `e2e` usa os mesmos envs do CI (`DATABASE_URL`, `BETTER_AUTH_*`, `WEB_ORIGIN`, `S3_*`)
  via um `.env` de exemplo documentado.

## Isolamento

- **Usuário novo por teste:** cada teste registra um e-mail aleatório (`signup-${uuid}@e2e.test`)
  pela UI. Como o RBAC isola tudo por usuário, os testes ficam **independentes e paralelizáveis**
  — sem reset/truncate de DB. Fluxos de 2 partes registram dois usuários.
- **Migrations:** aplicadas uma vez antes da suíte (`bun --filter @quitto/api run db:migrate`),
  como no CI.

## Setup de pré-requisitos

- O **wizard de criar contrato é exercido pela UI** apenas no `contracts.spec`.
- Nos demais specs, os pré-requisitos (contrato, parcelas, participante, convite) são **semeados
  por chamada direta à API** dentro de fixtures, usando o cookie de sessão do usuário recém-criado
  (Playwright `request` com o mesmo storage state) — mais rápido e estável que reclicar o wizard.

## Seletores

- Preferência por **acessíveis**: `getByRole`, `getByLabel`, `getByText` (os labels pt-BR já são
  fortes). Isso também serve de sinal para a 7c (a11y).
- **`data-testid` só onde há ambiguidade de lista:** linha de contrato (`contract-row-{id}`),
  parcela (`installment-row-{id}`), notificação (`notification-{id}`). Adicionados no plano.

## Matriz (8 specs)

1. **auth.spec** — signup→dashboard; logout→login; rota protegida deslogada redireciona a
   `/login?redirect=` e volta ao alvo após login; login com senha errada mostra erro.
2. **contracts.spec** — criar (auto) reflete na lista **e no dashboard**; criar (custom, valores
   variáveis); validação do wizard (título vazio / valor inválido bloqueia); editar parcela
   (owner); excluir contrato (owner) com confirmação.
3. **payments.spec** (contrato c/ confirmação, 2 usuários) — comprador envia comprovante →
   `aguardando`; vendedor confirma → `confirmada/paga`, recibo baixável; vendedor contesta
   (com motivo) → `contestada`, comprador reenvia; contrato **sem confirmação**: marcar paga
   direto; recibo **não** oferecido quando não-paga.
4. **rbac.spec** — usuário B abre `/contracts/$id` de A → tela de "não encontrado" (404 sem
   vazar); deep-link de parcela alheia bloqueado.
5. **invites.spec** (2 usuários) — owner adiciona participante + gera link travado por e-mail;
   convidado certo aceita → vira participante e vê o contrato; e-mail errado → "convite para outro
   e-mail"; já-participante → aviso; convite **já usado** → erro; remover participante; trocar papel.
6. **notifications.spec** (2 usuários) — comprovante enviado acende o sininho do vendedor;
   `/notifications` lista e o clique **deep-linka** pro drawer; "marcar todas como lidas" zera.
7. **lgpd.spec** — exportar dados baixa o JSON; excluir conta: frase errada mantém o botão
   desabilitado, "EXCLUIR" habilita → confirma → desloga (cai no login).
8. **dashboard.spec** — empty-state → CTA `/contracts/new`; após contratos + pagamento os stats
   batem; item de "próximas parcelas" deep-linka pro drawer.

## Ambiente de execução

- **CI = efêmero dentro do job, nunca prod.** O job sobe Postgres + MinIO descartáveis (como o
  `verify` atual), migra um banco zerado, sobe api+web no runner e o Playwright bate em
  `localhost:3001`. Tudo nasce/morre no job. Apontar para Neon/R2 de produção é proibido (o E2E
  exclui conta/contrato e sobe arquivos — destrutivo). Sem staging persistente.
- **Local:** o mesmo, via o `docker-compose` (pg+minio) + `webServer` do Playwright.

## Sem endpoints de teste (decisão)

Não há rota de seed/reset/login-bypass. O setup usa os **endpoints reais** com o cookie do
usuário (mantém o E2E honesto e evita backdoor — coerente com segurança-by-design). O isolamento
vem do usuário-novo-por-teste. Casos que a API pública não monta (convite **expirado**, **cron** de
lembretes) ficam cobertos no unit/integração, não no E2E.

## CI (fronteira com a trilha CD)

A 7b entrega o harness + specs **rodáveis localmente** e a **documentação do job de E2E**
(serviços pg+minio, env, ordem: migrations → `playwright install --with-deps` → build/serve →
`playwright test`). **O job na pipeline é escrito pelo usuário** (trilha CD; Claude ensina, não
escreve o YAML). O plano não altera `.github/workflows`.

## Arquivos (novos)

`docker-compose.yml` (raiz) · `e2e/package.json` · `e2e/playwright.config.ts` · `e2e/.env.example`
· `e2e/fixtures.ts` (auth + seed helpers + fixture PDF) · `e2e/specs/*.spec.ts` (8) · testids
pontuais em componentes de lista do `apps/web`. Doc: `docs/superpowers/guides/2026-06-14-e2e-ci-job.md`.

## Fora de escopo

Wiring do job no GitHub Actions (usuário/CD); testes de a11y automatizados (7c, axe); Lighthouse
(7d); cobertura exaustiva de toda validação (fica no unit/integração).
