# Guia — Google OAuth em produção

Habilitar o "Continuar com Google" no domínio de produção. Você **reaproveita o mesmo OAuth Client**
do dev — só adiciona o redirect de prod e ajusta a tela de consentimento.

## 1. Adicionar o redirect URI de produção

1. https://console.cloud.google.com → selecione o projeto (o mesmo do dev).
2. **APIs & Services → Credentials**.
3. Em **OAuth 2.0 Client IDs**, clique no client que você já usa em dev.
4. Em **Authorized redirect URIs**, clique **+ ADD URI** e cole **exatamente**:

   ```
   https://usequitto.vercel.app/api/auth/callback/google
   ```

   (Mantenha também o de localhost: `http://localhost:3000/api/auth/callback/google`.)
5. *(Opcional, mas seguro)* Em **Authorized JavaScript origins**, adicione
   `https://usequitto.vercel.app`.
6. **Save.** Pode levar alguns minutos pra propagar.

> Por que esse caminho exato: o Better Auth tem `basePath: "/api/auth"` e o provider `google`, então
> o callback é `/api/auth/callback/google`. Como o front é same-origin e o `vercel.json` faz proxy do
> `/api`, o domínio público correto é `usequitto.vercel.app` (não o `*.fly.dev`). É o mesmo motivo de
> `BETTER_AUTH_URL = https://usequitto.vercel.app`.

## 2. Tela de consentimento (o gotcha que bloqueia login)

**APIs & Services → OAuth consent screen.** Veja o **Publishing status**:

- **Se estiver "Testing":** só e-mails na lista de **Test users** conseguem logar; qualquer outro vê
  *"Access blocked: app não verificado / não autorizado"*. Duas saídas:
  - **Para uso pessoal/poucas pessoas:** adicione os e-mails em **Test users** e pronto.
  - **Para qualquer um logar:** clique **Publish app** → status vira **In production**.
- **Publicar exige verificação do Google?** Não, neste caso. O Quitto usa só escopos **não sensíveis**
  (`openid`, `email`, `profile`). Esses não disparam o processo de verificação — no máximo aparece a
  tela "Google não verificou este app" (o usuário clica em *Avançado → continuar*). Verificação só
  seria necessária com escopos sensíveis/restritos, que não é o caso.

**Recomendação:** se é pra você validar agora, **Testing + seu e-mail em Test users** é o mais rápido.
Quando abrir pra usuários reais, **Publish app**.

## 3. Conferir os valores que vão pro Fly

Não muda nada aqui — você usa o **mesmo** `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` do dev (estão
na tela do OAuth Client). Eles entram no `fly secrets set` da Task 8.

## 4. Aceite

- O redirect `https://usequitto.vercel.app/api/auth/callback/google` está salvo.
- A tela de consentimento está em **In production** (ou seu e-mail está em **Test users**).
- Você tem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` à mão pro deploy.

(Validação real do fluxo acontece no smoke test — Task 10, item 2.)
