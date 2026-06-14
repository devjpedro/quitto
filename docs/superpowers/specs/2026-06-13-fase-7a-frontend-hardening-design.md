# Fase 7a — Hardening de frontend (sessão + coerência de cache)

**Data:** 2026-06-13
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§6 performance/a11y)

Primeira fatia da Fase 7 (Polimento). Web-only, sem mudança de API. Ataca dois problemas reais
observados em uso, antes das fatias de E2E (7b), a11y (7c) e performance/Lighthouse (7d).

## Problemas

1. **`get-session` a cada navegação.** `protected.tsx` chama `authClient.getSession()` no
   `beforeLoad` de toda rota protegida; a sidebar ainda usa `useSession()`. Resultado: request de
   sessão por clique de navegação.
2. **Token exposto no client.** O `get-session` do Better Auth devolve `session.token` no corpo;
   ler isso no JS enfraquece o `httpOnly` do cookie (um XSS poderia exfiltrar). O client não
   precisa do token — só de `{ id, name, email, image }`.
3. **Cache incoerente.** O agregado `['dashboard']` (6a) não é invalidado pelas mutations de
   escrita; `['contracts']` tem furos. Ex.: criar um contrato e voltar ao dashboard mostra o
   estado vazio antigo. Afeta criar contrato, editar parcela, pagamento, aceitar convite e
   gestão de participantes.

## Decisões

- **Fonte de sessão = `GET /api/me` cacheado** (já existe; retorna sem token). O client deixa de
  chamar o `get-session` do Better Auth — resolve (1) e (2) de uma vez. `signIn/signUp/signOut`
  continuam no Better Auth.
- **Login/logout = reload completo** (já é assim: `window.location.href`). Logo a sessão no
  client vive só durante a navegação SPA; não há estado a sincronizar entre login e guard.
- **`staleTime` de 5 min** na query de sessão: ~1 request a cada 5 min de navegação (em vez de
  por clique), e revalida periodicamente para pegar expiração do lado servidor.
- **Coerência de cache centralizada:** um helper `invalidateContractViews(qc, contractId?)`
  concentra a regra (sempre invalida `contracts` + `dashboard`, e `contract(id)` quando há um).
  Todas as mutations de escrita o usam — "esquecer o dashboard" deixa de ser possível.
- **Code-splitting fica para a 7d** (performance).

## Mudanças

### 1. Sessão (`hooks/use-me.ts` — criar)

```
meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: () => unwrap(api.api.me.get()),
  staleTime: 5 * 60_000,
});
useMeQuery();
```
`query-keys.ts`: adiciona `me: ['me']`.

### 2. Guard (`routes/protected.tsx`)

`beforeLoad` passa a:
```
try { await queryClient.ensureQueryData(meQueryOptions); }
catch (err) {
  if (err instanceof ApiError && err.httpStatus === 401)
    throw redirect({ to: '/login', search: { redirect: location.href } });
  throw err;
}
```
Remove o import/uso de `authClient` aqui. (O `getSession` reativo do Better Auth deixa de ser
chamado.)

### 3. Sidebar (`components/app-sidebar.tsx`)

Troca `useSession()` por `useMeQuery()` — exibe `data?.name`. `signOut` segue de `auth-client`.
Remove `useSession` do uso.

### 4. Coerência de cache

`hooks/use-invalidate-contract-views.ts` (ou helper em `lib/`):
```
function invalidateContractViews(qc, contractId?) {
  qc.invalidateQueries({ queryKey: queryKeys.contracts });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  if (contractId) qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
}
```
Aplicado em:
- `use-contract-mutations`: `createContract` (sem id) e `updateInstallment` (com id).
- `use-payment-mutations`: `invalidatePayment` passa a também invalidar `dashboard` (mantém
  `installment(id)`).
- `use-invite`: aceitar convite → `invalidateContractViews(qc)` + mantém `myInvites`.
- `use-participant-mutations`: add/remove/role → `invalidateContractViews(qc, contractId)`.

`notifications`/`notificationsUnread` ficam fora (o sininho faz polling de 60s; o ator nunca
recebe notificação da própria ação).

## Testes (Vitest)

- **`useMeQuery`**: desembrulha `/api/me` (mock do treaty).
- **Guard**: extrair a checagem para uma função testável `requireSession(queryClient, location)`
  que o `beforeLoad` chama; teste: `ensureQueryData` resolvendo → não redireciona; lançando
  `ApiError 401` → lança `redirect` para `/login` com `search.redirect`.
- **Sidebar**: mostra o nome vindo do `useMeQuery` (mock do hook).
- **Coerência**: cada mutation de escrita invalida `['dashboard']` — espionar
  `qc.invalidateQueries` (padrão já usado em `use-notifications.test`/`use-contracts.test`).
- **Grep de regressão** (passo de verificação): zero `getSession`/`useSession` remanescente em
  `apps/web/src`.

## Fora de escopo (outras fatias da Fase 7)

Code-splitting de rotas e Lighthouse (7d); E2E Playwright (7b); a11y/WCAG, estados vazios/erro,
foco (7c). Feature de cancelar/concluir contrato é decisão à parte (não é polimento).
