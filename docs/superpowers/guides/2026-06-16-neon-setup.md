# Guia — Banco de produção no Neon (Postgres)

Passo a passo pra criar o Postgres de produção no Neon e obter as connection strings.

**Importante:** você vai pegar **duas** variantes da string da mesma base:
- **Pooled** (com `-pooler` no host) → vira o secret `DATABASE_URL` no **Fly** (runtime da API).
- **Direct** (sem `-pooler`) → usada **só pra rodar as migrations** (Task 4), porque o `drizzle-kit
  migrate` pega um *advisory lock* de sessão que o pooler (modo transação) não mantém bem.

## 1. Criar o projeto

1. Login em https://console.neon.tech.
2. **Create project**.
3. **Name:** `quitto`.
4. **Postgres version:** a default (16/17) serve.
5. **Region:** a mais próxima do Fly `gru` (São Paulo) — escolha **AWS South America (São Paulo) /
   `sa-east-1`** se disponível; senão, a mais próxima (ex.: US East). Latência menor = app mais rápido.
6. **Database name:** pode deixar a default (`neondb`) ou criar `quitto`. Anote qual ficou.
7. Create.

## 2. Pegar as connection strings

Na tela do projeto (ou em **Dashboard → Connection Details**):

1. Há um widget de connection string com um toggle **"Pooled connection"**.
2. **Com o toggle LIGADO** → copie a string **pooled** (o host tem `-pooler`), algo como:

   ```
   postgresql://<user>:<password>@ep-nome-123-pooler.sa-east-1.aws.neon.tech/<db>?sslmode=require
   ```
   → este é o **`DATABASE_URL`** que vai pro secret do Fly (Task 8).

3. **Com o toggle DESLIGADO** → copie a string **direct** (host **sem** `-pooler`):

   ```
   postgresql://<user>:<password>@ep-nome-123.sa-east-1.aws.neon.tech/<db>?sslmode=require
   ```
   → esta é só pra **rodar as migrations** agora (Task 4).

Guarde as duas com segurança (não commite, não cole em chat).

## 3. Rodar as migrations (Task 4) com a string DIRECT

Da pasta `apps/api`, com a string **direct**. O `drizzle.config` chama `parseEnv()`, que exige 4
variáveis mesmo só pra migrar — as 3 extras aqui são só placeholders pra passar a validação (o
`migrate` usa apenas `DATABASE_URL`):

```bash
cd apps/api
env DATABASE_URL='<string-DIRECT-do-neon>' \
    BETTER_AUTH_SECRET='migracao-placeholder-32-caracteres-ok' \
    BETTER_AUTH_URL='https://usequitto.vercel.app' \
    WEB_ORIGIN='https://usequitto.vercel.app' \
    bun run db:migrate
cd ../..
```

**Aceite:** a saída lista as 9 migrations aplicadas, sem erro. No console do Neon → **Tables**,
aparecem `user`, `session`, `account`, `contract`, `installment`, `notification`, etc.

> Se der erro de advisory lock / "prepared statement" usando a string pooled, é exatamente por isso
> que aqui usamos a **direct**. Cole o erro que eu ajudo.

## 4. O que vai pro Fly (Task 8)

| Secret | Valor |
|---|---|
| `DATABASE_URL` | a string **pooled** (com `-pooler`) — passo 2.2 |

(O runtime da API usa a pooled; a direct serviu só pra migrar.)

## 5. Notas do free tier

- O free tier do Neon **autosuspende** a base após inatividade → a primeira request depois de um
  tempo ocioso tem um *cold start* de algumas centenas de ms. Normal pra MVP.
- Um projeto/uma branch de prod já basta. (Staging viria como outra branch do Neon, no futuro com o CD.)
