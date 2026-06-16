# Guia — Google OAuth (criar do zero, dev + prod)

O Quitto ainda **não tem** um OAuth Client próprio. Este guia cria tudo do zero no Google Cloud:
projeto → tela de consentimento → OAuth Client → credenciais. As credenciais resultantes
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) servem **tanto pro dev** (`.env`) **quanto pra prod**
(secret no Fly) — só mudam os redirect URIs (cadastramos os dois).

> **Recomendado:** um **projeto novo** no Google Cloud só pro Quitto (isolamento de credenciais e
> tela de consentimento). Reusar um projeto existente funciona, mas mistura branding/escopos.

## 1. Criar o projeto

1. https://console.cloud.google.com → seletor de projeto (topo) → **New Project**.
2. **Name:** `Quitto` → **Create** → selecione o projeto recém-criado.

## 2. Configurar a tela de consentimento (OAuth consent screen / "Google Auth Platform")

No menu, **APIs & Services → OAuth consent screen** (no console novo pode aparecer como
**Google Auth Platform → Branding/Audience**). Preencha:

1. **User type / Audience:** **External**.
2. **App name:** `Quitto`.
3. **User support email:** seu e-mail.
4. **Developer contact email:** seu e-mail.
5. **Scopes:** **não adicione nada** — os escopos `openid`, `email`, `profile` (não sensíveis) já
   bastam e vêm por padrão. Não pedir escopo sensível = sem processo de verificação do Google.
6. **Publishing status / Audience:**
   - **Testing** (mais rápido pra validar agora): adicione seu e-mail em **Test users**. Só esses
     e-mails conseguem logar; outros veem "Access blocked".
   - **In production** (pra qualquer um logar): clique **Publish app**. Aparece só a tela "Google não
     verificou este app" (usuário clica *Avançado → continuar*) — aceitável pros escopos básicos.
7. Salve.

## 3. Criar o OAuth Client (credenciais)

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. **Application type:** **Web application**.
3. **Name:** `Quitto Web`.
4. **Authorized JavaScript origins** (adicione os dois):
   - `http://localhost:3001`  (web em dev)
   - `https://usequitto.vercel.app`  (web em prod)
5. **Authorized redirect URIs** (adicione os dois — o caminho é do Better Auth: `basePath
   "/api/auth"` + provider `google`):
   - `http://localhost:3000/api/auth/callback/google`  (dev)
   - `https://usequitto.vercel.app/api/auth/callback/google`  (prod)
6. **Create.** Aparece um modal com **Client ID** e **Client Secret** — copie os dois.

> Em prod o domínio público é `usequitto.vercel.app` (não o `*.fly.dev`), porque o front é
> same-origin e o `vercel.json` faz proxy do `/api`. É o mesmo motivo de
> `BETTER_AUTH_URL = https://usequitto.vercel.app`.

## 4. Onde usar as credenciais

- **Dev (opcional, pra testar o Google localmente):** colocar no `apps/api/.env`:
  ```
  GOOGLE_CLIENT_ID=<client-id>
  GOOGLE_CLIENT_SECRET=<client-secret>
  ```
  (Sem elas, o dev sobe só com e-mail/senha — o provider Google é opcional no código.)
- **Prod:** entram no `fly secrets set` da Task 8 (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).

## 5. Aceite

- Projeto `Quitto` criado; consent screen configurada (Testing + seu e-mail, ou In production).
- OAuth Client `Quitto Web` criado com os **4** URIs (2 origins + 2 redirects, dev e prod).
- Você tem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` guardados.

(Validação real do login Google é o item 2 do smoke test — Task 10.)
