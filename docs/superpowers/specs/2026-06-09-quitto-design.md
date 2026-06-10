# Quitto — Gestão de Contratos & Parcelas — Design

> **Status:** design aprovado em brainstorming, aguardando revisão final.
> **Data:** 2026-06-09
> **Nome:** Quitto (de *quitar*).

## 1. Visão geral

Sistema web para gerenciar contratos parcelados (compra, aluguel ou contratos em geral) entre
partes — comprador/vendedor — ou para uso individual. Cada contrato tem um cronograma de
parcelas; cada parcela pode receber comprovantes (PDF/imagem) e ser marcada como paga, com ou
sem confirmação da outra parte. Notificações in-app mantêm as partes informadas, e lembretes
automáticos avisam sobre vencimentos.

**Objetivo atual:** ferramenta pessoal primeiro (resolver o caso real do autor: um contrato de
compra de apartamento 60x e um de aluguel 12x), com qualidade de portfólio (testes, segurança,
performance, acessibilidade). Generalização para outros usuários/imobiliárias e app mobile ficam
para o futuro, mas o design não deve impedi-los.

### Casos de uso do autor (referência)
- **Compra:** R$ 120.000 em 60 parcelas, autor é comprador.
- **Aluguel:** R$ 800/mês, contrato de 1 ano (12 parcelas), autor é locatário/comprador.

## 2. Escopo

### MVP
- Cadastro/login (Google em prod; e-mail+senha em dev/testes).
- Criar contrato (assistente em 3 passos): básico → parcelas → participantes (opcional).
- Geração automática do cronograma de parcelas; edição de parcelas individuais (valor variável,
  ex.: entrada maior ou parcela final diferente).
- Anexar comprovante(s) (PDF/JPG/PNG) por parcela.
- Marcar parcela como paga — fluxo **configurável por contrato** (`exigeConfirmacao`):
  - com confirmação: `pendente → aguardando confirmação → confirmada | contestada`;
  - sem confirmação: `pendente → paga`.
- Anexar o **contrato original** (PDF) ao contrato.
- Papéis por contrato: `owner`, `comprador`, `vendedor`, `convidado` (somente leitura).
- Participante como **contato** (sem conta) ou **usuário real** via **link de convite**.
- Uso **solo** (sem convidar ninguém) totalmente suportado.
- **Dashboard / visão geral**: total pago vs. restante, % quitado, próxima parcela, atrasadas.
- **Trilha de auditoria** por parcela (eventos imutáveis: quem fez o quê e quando).
- **Badges de atraso** (parcela vencida em vermelho, "atrasada há N dias").
- **Notificações in-app** (sininho + lista) + **lembretes automáticos** (cron diário).
- Navegação entre múltiplos contratos do usuário.
- **Recibo/declaração de quitação em PDF** (parcela paga / contrato quitado).
- **Exportar extrato** do contrato (PDF/CSV).
- **LGPD:** exportar meus dados e excluir conta (remove contratos próprios e arquivos no R2).

### Fora do MVP (backlog priorizado)
- Recorrência/renovação/reajuste anual de aluguel; juros/multa por atraso; pagamento parcial.
- Convidado via link público read-only (sem login).
- OCR/IA no comprovante (extrair valor/data).
- Integração de pagamento real (Pix/Asaas/Stripe); geração de boleto/Pix QR.
- Multi-tenant / painel de imobiliária (organização com vários corretores, relatórios).
- Assinatura digital de contrato.
- Notificações por e-mail/push/WhatsApp.
- 2FA próprio e criptografia de campo em repouso (Google cobre 2FA; R2 cifra arquivos em repouso).
- App mobile / PWA.

### Distinção importante: multi-contrato ≠ multi-tenant
"Um usuário ter vários contratos e navegar entre eles" é relação um-para-muitos e **está no MVP**.
**Multi-tenancy** (camada de organização/imobiliária com equipe e carteira compartilhada) é
direção SaaS futura. O schema será modelado para permitir introduzir uma tabela `organization`
acima do usuário sem migração traumática.

## 3. Modelo de domínio

- **User** — identidade de login (Better Auth).
- **Contract** — título, descrição, papel do dono (comprador/vendedor/neutro), valor total,
  nº de parcelas, `exigeConfirmacao` (bool), status (`ativo`/`concluído`/`cancelado`), criador,
  PDF do contrato original (opcional).
- **Installment (Parcela)** — `contractId`, nº sequencial (1..N), valor, vencimento, status,
  `paidAt`/`confirmedAt`.
- **Proof (Comprovante)** — `installmentId`, referência ao arquivo no R2 (chave randômica), nome
  original, MIME, tamanho, quem subiu, quando. Uma parcela pode ter 1+ comprovantes.
- **Participant** — `contractId`, nome, papel (`owner`/`comprador`/`vendedor`/`convidado`),
  `linkedUserId` (nulo = só contato; preenchido = usuário com acesso).
- **Invite** — token criptográfico, expiração, uso único, escopado a `contractId`+`participantId`.
- **Notification** — destinatário (`userId`), tipo, referência (contrato/parcela), `readAt`.
- **AuditEvent** — `contractId`/`installmentId`, tipo de evento, ator, timestamp, payload. Imutável.

### Máquina de estados da parcela
- **Com confirmação:** `pendente` → (comprador anexa comprovante e envia) `aguardando confirmação`
  → (vendedor) `confirmada` **ou** `contestada` → volta para `aguardando confirmação`/`pendente`.
- **Sem confirmação:** `pendente` → (parte com permissão registra) `paga`. Comprovante é anexo
  opcional/histórico.

### Papéis & permissões (deny-by-default, validado no backend)
- **owner** — controle total do contrato (criar/editar/excluir, gerar parcelas, gerenciar
  participantes e convites). Também tem um lado (comprador/vendedor) para agir no fluxo de pagamento.
- **comprador** — anexa comprovante e marca/envia pagamento. *Não* confirma o próprio pagamento.
- **vendedor** — confirma ou contesta pagamentos.
- **convidado** — somente leitura.

## 4. Arquitetura & stack

### Repositório — monorepo (Bun workspaces + Turborepo)
```
/ (repo)
├─ apps/
│  ├─ api/    → Bun + Elysia (backend)
│  └─ web/    → React + Vite (frontend)
└─ packages/
   └─ shared/ → schemas Zod + tipos de domínio compartilhados
```
- **Bun** é o gerenciador de pacotes (workspaces) dos dois apps + `shared`. No `api` também é
  runtime (Elysia); no `web` é gerenciador/instalador (Vite roda o dev server). A Vercel suporta
  instalação com Bun no deploy do front.
- **Turborepo** é o orquestrador de tarefas com cache (`turbo run build/test/lint` em paralelo).
- Monorepo é necessário para o **Eden** importar o tipo do servidor Elysia no front
  (type-safety ponta-a-ponta sem codegen). Não é o "monorepo pesado de SaaS".

### Stack por camada
| Camada | Escolha |
|---|---|
| Backend | Bun + Elysia + Eden; Drizzle ORM; validação por schemas Zod (`shared`) |
| Auth | Better Auth — Google (prod) + e-mail/senha (dev/testes); sessão em cookie httpOnly |
| Banco | PostgreSQL no Neon (free tier) |
| Arquivos | Cloudflare R2 (S3-compatible, bucket privado) |
| Frontend | React + Vite; TanStack Router + TanStack Query; Tailwind + shadcn/ui; cliente Eden |
| Monorepo | Bun workspaces (gerenciador) + Turborepo (task runner com cache) |
| Agendado | Job diário no Fly (lembretes de vencimento/atraso → notificações in-app) |
| Observabilidade | Sentry (free tier) + health check |

### Risco conhecido & mitigação: Eden + Better Auth em monorepo
A issue [eden#215](https://github.com/elysiajs/eden/issues/215) (aberta, Elysia 1.4.x) faz o **Eden
Treaty perder a inferência (retorna `any`)** quando o plugin do Better Auth (`.mount()` + `.macro()`)
é usado **dentro de um módulo importado cruzando pacotes**. Mitigação adotada — **desacoplar auth da
API tipada**:
- Better Auth montado como **handler puro** (`.mount('/api/auth', auth.handler)`) — não injeta tipos
  de macro no app, não polui o Eden.
- O **front usa o client do próprio Better Auth** (`createAuthClient`) para auth; o Eden tipa **apenas
  as rotas de negócio** (contratos/parcelas).
- Autorização nas rotas de negócio via guard `beforeHandle` (não altera tipo de resposta).
- **Spike de type-safety no início** para confirmar que os tipos sobrevivem no workspace; se não
  sobreviverem, fallback para cliente tipado via OpenAPI (que o Elysia já gera).

### Deploy (gratuito, sem domínio)
- **web** → Vercel (build estático, `*.vercel.app`).
- **api** → Fly.io via Docker (`*.fly.dev`).
- **Postgres** → Neon. **Arquivos** → R2.

### Conectividade & sessão — proxy de mesma origem (reverse proxy)
Como front (`*.vercel.app`) e back (`*.fly.dev`) são sites diferentes, o cookie de sessão padrão do
Better Auth (`SameSite=Lax`) seria cookie de terceiro e os navegadores bloqueariam. Solução (padrão
reverse proxy, recomendado pela doc do Better Auth quando não há domínio raiz comum):
- **`vercel.json` no front** com um *rewrite* `"/api/:path*"` → `https://<api>.fly.dev/api/:path*`.
- O navegador só conversa com `*.vercel.app`; a Vercel encaminha pro Fly nos bastidores. Cookie fica
  **first-party** (`SameSite=Lax`, `httpOnly`, `Secure`) — sem depender de cookies de terceiros.
- Bônus: vira **same-origin** → CORS deixa de ser necessário; o front chama só `/api/...` (relativo).
- Custo: tráfego de API passa pelo edge da Vercel (free tier dá conta). **Não é gambiarra** — é
  reverse proxy clássico (mesma ideia de nginx/BFF/rewrites do Next).

### Fluxo de dados (exemplo: enviar comprovante, contrato com confirmação)
Upload via **URL pré-assinada** — os bytes do arquivo vão direto do navegador para o R2 (não passam
pela API nem pelo proxy), evitando limite de corpo e ganhando performance:
1. Front pede URL de upload → `POST /api/installments/:id/proofs/presign`.
2. API valida sessão + papel (é comprador?) → devolve **URL pré-assinada** do R2 (curta duração).
3. Navegador faz `PUT` do arquivo **direto no R2** (chave randômica).
4. Front confirma → `POST /api/installments/:id/proofs` com a chave do objeto.
5. API verifica o objeto no R2 (tipo/tamanho), cria `Proof`, muda parcela para `aguardando
   confirmação`, grava `AuditEvent` e cria `Notification` para o vendedor.
6. Front invalida as query keys afetadas → UI atualiza.

### Job agendado (lembretes)
Cron diário no Fly varre parcelas vencendo em X dias (configurável) e vencidas, e gera
notificações in-app apenas para participantes com conta vinculada. Sem dependência externa de e-mail.

## 5. UI / UX

### Identidade visual — "B2"
- Base quente/acolhedora: superfícies em areia, cantos suaves, sombras sutis.
- **Cor de marca:** teal (`#0f766e`) — quente porém distinto dos status, transmite confiança.
- **Status sempre semânticos:** 🟢 verde = paga/confirmada · 🟡 âmbar = pendente/aguardando ·
  🔴 vermelho = vencida/contestada.

### Estrutura
- **App shell:** sidebar (Dashboard, Contratos, Notificações, Ajustes); vira bottom-nav no mobile.
- **Tela de contrato (coração):** stats no topo (total/pago/restante/vencidas) + barra de progresso
  → abas (Parcelas, Participantes, Documentos, Histórico) → lista de parcelas → **painel lateral
  (drawer)** com detalhe da parcela selecionada (comprovante, ações, mini trilha de auditoria).
- **Criar contrato:** assistente em 3 passos (básico → parcelas → participantes/convite opcional).

### Diretriz de UI (obrigatória)
Ao construir qualquer UI, **usar skills de design antes** (frontend-design / ui-ux-pro-max /
web-design-guidelines). **Não** produzir interfaces genéricas com "cara de IA". Aterrar o trabalho
na identidade B2 e em padrões reais de design.

## 6. Performance & acessibilidade

- **Meta:** Lighthouse 100 em Performance, Best Practices, SEO e Accessibility — **e** WCAG 2.2 AA
  de verdade (teclado, foco gerenciado ao abrir drawer/modais, ARIA, contraste, teste com leitor
  de tela). O score do Lighthouse não substitui a11y real; shadcn/ui (Radix) dá base acessível.
- **Performance:** code-splitting por rota (lazy do TanStack Router), lazy em drawer/modais, bundle
  enxuto, fontes otimizadas, imagens/thumbnails lazy.

### Disciplina de dados (TanStack Query)
- `staleTime`/`gcTime` sensatos; query keys estruturadas; sem refetch à toa.
- **Prefetch via route loaders** (`ensureQueryData`) para evitar waterfalls.
- Mutations com **invalidação alvo** (só as keys afetadas) + optimistic update quando fizer sentido;
  nada de `invalidateQueries()` global.
- `select` para minimizar re-render; lista longa de parcelas paginada/infinite.

## 7. Segurança (prevenção por design)

1. **Broken Access Control / IDOR (risco nº1):** toda query escopada ao usuário autenticado;
   middleware carrega o papel do usuário *naquele* contrato e nega por padrão; matriz papel×ação no
   backend (convidado não muta; comprador não confirma o próprio pagamento; só vendedor confirma).
2. **SQL Injection:** Drizzle parametrizado, zero concatenação; entrada validada por Zod.
3. **Mass assignment:** nunca jogar `req.body` no insert/update — só campos da whitelist do schema.
4. **XSS:** React escapa por padrão; proibido `dangerouslySetInnerHTML` sem sanitização; CSP.
5. **Upload (pré-assinado):** presign valida sessão+papel e restringe MIME/tamanho na própria URL do
   R2; no confirm a API revalida o objeto (MIME + magic bytes + tamanho); sem SVG; nomes randômicos;
   bucket privado; download via URL assinada de curta duração com `Content-Disposition`.
6. **Auth/sessão:** cookie httpOnly+Secure+SameSite=Lax (first-party via proxy de mesma origem);
   expiração/rotação; `state` no OAuth; rate limit no login.
7. **CSRF:** cookies SameSite + proteção CSRF em requisições que alteram estado.
8. **Convites:** token criptográfico, expiração, uso único, escopado.
9. **Misconfiguration:** CORS restrito; erros verbosos só em dev; headers (CSP, HSTS,
   X-Content-Type-Options, frame-ancestors).
10. **Segredos:** só em env vars (`.env` no gitignore); nada de segredo no bundle do front; HTTPS;
    sem logar PII/segredos.
11. **Dependências:** `bun audit` + Dependabot no CI; libs atualizadas.
12. **Logging/auditoria:** trilha de auditoria também como log de segurança; eventos de auth logados.

## 8. Tratamento de erros

### Backend (Elysia)
- Hierarquia `AppError` (`code`, `httpStatus`, `message`, `details?`) com subclasses:
  `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `BusinessRuleError`.
- **`onError` central** mapeia tudo para um envelope JSON consistente + status correto; em produção
  não vaza stack; loga no Sentry. Erros de validação de schema entram formatados por campo.
- O Eden carrega o tipo do erro para o front.
- **Envelope custom com `code`** (decisão): `{ "error": { "code": "CONTRACT_NOT_FOUND",
  "message": "...", "details": { ... } } }`. `code` é um enum estável (ótimo para o front tratar e
  traduzir por código), independente da mensagem.

### Frontend (React)
- **Client fino `apiClient`** envolvendo o Eden: configura base `/api` + `credentials:'include'` e
  **normaliza** o `{ data, error }` do Eden lançando um `ApiError` tipado (React Query trata como
  erro). Ponto único de import.
- **TanStack Query:** `QueryCache`/`MutationCache` com `onError` global (toast para erro inesperado);
  tratamento pontual para erros esperados; `throwOnError` em rotas → cai no error boundary.
- **Error boundaries por rota** (`react-error-boundary`) com fallback amigável; reset ao navegar.
- **Toasts** via `sonner`; erros de validação mapeados de `details` para os campos (React Hook Form).
- Mapa erro→UX por `code`/status: 401 → login; 403 → "sem permissão"; 404 → not-found; 5xx →
  genérico + Sentry.

## 9. Qualidade de código & tooling

### Convenção de idioma (obrigatória)
- **Código em inglês:** identificadores (variáveis, funções, tipos, enums), nomes de arquivos/pastas,
  rotas/paths da API, chaves de domínio e **comentários no código**. Entidades em inglês
  (`Contract`, `Installment`, `Proof`, `Participant`, `Notification`), rotas em inglês
  (`/api/contracts`, `/api/installments/:id/proofs`), códigos de erro em inglês
  (`CONTRACT_NOT_FOUND`). Nada de "Portuglish" (`getContratoById`).
- **Conteúdo ao usuário em pt-BR:** todo texto visível ao usuário — labels, botões, mensagens de
  erro exibidas, notificações, textos de e-mail/PDF. Centralizado para facilitar (futuro i18n).
- **Docs e mensagens de commit:** pt-BR (comunicação do time).

### Tooling
- **Biome + Ultracite** (lint + format) e **Lefthook** no pre-commit.
- Pre-commit: Biome nos arquivos staged + `tsc --noEmit` (typecheck).
- **tsconfig strict** (sem `any`).
- Conventional commits (commit-msg hook) — opcional.
- **Comentários:** sem comentários inúteis/óbvios "de IA"; comentar só o não-óbvio (porquê,
  gotchas). Bom nome > comentário.
- **Validação de env no boot** (`Zod.parse(process.env)`) — falha cedo se faltar segredo.
- **Migrations versionadas** (Drizzle Kit) no CI + seed para dev/testes.

## 10. Testes

- **Unit:** regras de domínio puras (gerar cronograma, transições de estado, progresso/atraso).
- **Integração (API):** endpoints contra Postgres efêmero, cobrindo permissões por papel e a
  máquina de estados.
- **E2E (Playwright):** fluxos críticos — criar contrato → enviar comprovante → confirmar → ver
  notificação. Login via e-mail/senha para automatizar.
- **CI (GitHub Actions):** lint + typecheck + migrations + suite completa a cada push.

## 11. Decisões em aberto / a confirmar na implementação
- Periodicidade das parcelas no MVP: mensal fixa (recorrência/outras periodicidades = backlog).
- Detalhe da política de retenção LGPD dos comprovantes (prazo de expurgo após exclusão).
