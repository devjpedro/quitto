# Guia — Criar o bucket R2 (storage de produção)

Passo a passo pra configurar o Cloudflare R2 e obter os 5 valores que viram secrets no Fly
(`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).

O bucket é **privado**: o navegador nunca acessa o bucket direto — a API gera **URLs pré-assinadas**
(PUT pra subir, GET pra baixar). O único motivo de mexer em CORS é o **upload PUT** sair do navegador.

## 1. Ativar o R2 na conta

1. Login em https://dash.cloudflare.com → menu lateral **R2**.
2. Se for a primeira vez, clique em **Purchase R2 / Enable**. Pode pedir cartão pra ativar o billing,
   mas o **free tier** (10 GB de storage, sem custo de egress) cobre o MVP com folga.

## 2. Anotar o Account ID → vira o `S3_ENDPOINT`

Na página do R2 (ou em **Manage R2 API Tokens**) aparece o **Account ID** e o endpoint S3 da conta:

```
S3_ENDPOINT = https://<account_id>.r2.cloudflarestorage.com
```

Copie esse endpoint exatamente (com o seu `account_id`).

## 3. Criar o bucket

1. **R2 → Create bucket**.
2. **Name:** `quitto-proofs`.
3. **Location:** Automatic (ou a region hint mais próxima — ex.: ENAM/SAM; não é crítico).
4. Deixe **público desligado** (Public access **off** — é privado).
5. Create.

```
S3_BUCKET = quitto-proofs
S3_REGION = auto      ← o R2 ignora a region, mas o AWS SDK exige um valor
```

## 4. Criar o API Token (credenciais S3)

1. **R2 → Manage R2 API Tokens → Create API token**.
2. **Permissions:** `Object Read & Write`.
3. **Scope:** `Apply to specific buckets only` → selecione `quitto-proofs` (princípio do menor privilégio).
4. **TTL:** sem expiração (ou longo).
5. Create. A tela mostra **uma única vez**:
   - **Access Key ID** → `S3_ACCESS_KEY_ID`
   - **Secret Access Key** → `S3_SECRET_ACCESS_KEY`

   ⚠️ Copie os dois agora — o Secret não é exibido de novo. Se perder, é só revogar e criar outro.

## 5. Configurar o CORS do bucket

**Bucket `quitto-proofs` → Settings → CORS Policy → Edit/Add**, e cole:

```json
[
  {
    "AllowedOrigins": ["https://usequitto.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Salve. Sem isso, o navegador bloqueia o preflight do upload e o comprovante **falha calado**
(o item 6 do smoke test não passa).

> Quando você for pra domínio próprio (futuro), adicione a nova origem aqui também.

## 6. Resumo — o que vai pros secrets do Fly (Task 8)

| Secret | De onde veio |
|---|---|
| `S3_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` (passo 2) |
| `S3_REGION` | `auto` (fixo) |
| `S3_BUCKET` | `quitto-proofs` (passo 3) |
| `S3_ACCESS_KEY_ID` | Access Key ID do token (passo 4) |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key do token (passo 4) |

## 7. Teste rápido (opcional, antes do deploy)

Com a AWS CLI apontando pro endpoint do R2 dá pra validar as credenciais sem depender da app:

```bash
env AWS_ACCESS_KEY_ID='<access-key>' AWS_SECRET_ACCESS_KEY='<secret-key>' \
  aws s3 ls --endpoint-url 'https://<account_id>.r2.cloudflarestorage.com'
```

Aceite: lista o bucket `quitto-proofs` sem erro de credencial. (CORS não é testável por aqui — só
no navegador, no smoke test.)
