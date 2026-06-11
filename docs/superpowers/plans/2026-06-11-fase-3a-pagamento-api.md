# Fase 3a — Pagamento & Comprovantes (API) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend do fluxo de pagamento — upload de comprovante via **URL pré-assinada** (S3/R2, testado localmente com MinIO), **máquina de estados** da parcela (com/sem confirmação) e **trilha de auditoria** append-only. Sem UI (Fase 3b).

**Architecture:** A transição de estado da parcela vive numa **função pura** (`lib/installment-state.ts`) testável isoladamente. O storage é abstraído em `lib/storage.ts` (S3 SDK apontando para R2 em prod / MinIO em dev/CI). Endpoints seguem o padrão do projeto (módulo Elysia `prefix:"/api"`, `requireAuth` no handler, TypeBox, RBAC via `getContractRole`). Toda transição grava um `audit_event`. Upload: o byte vai do cliente **direto pro storage** (presign); a API só autoriza e confirma.

**Tech Stack:** Elysia + TypeBox, Drizzle, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, MinIO (dev/CI), `bun test`.

> **Convenção (spec §9):** código/rotas/identificadores/comentários em inglês; mensagens ao usuário em pt-BR. Dinheiro em centavos.

> **Pré-requisitos:**
> - Fases 0–2 em `develop`. Postgres local de pé.
> - **MinIO** (storage S3-compatível p/ dev e testes):
>   ```
>   docker run -d --name quitto-minio -p 9000:9000 -p 9001:9001 \
>     -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio12345 \
>     quay.io/minio/minio server /data --console-address ":9001"
>   ```
>   Crie o bucket uma vez (console http://localhost:9001 ou via SDK no Step de teste).
> - **Envs adicionais** ao rodar a API/testes:
>   ```
>   S3_ENDPOINT=http://localhost:9000  S3_REGION=us-east-1  S3_BUCKET=quitto-proofs
>   S3_ACCESS_KEY_ID=minio  S3_SECRET_ACCESS_KEY=minio12345
>   ```
> - Crie a branch `feat/fase-3a-pagamento-api` a partir de `develop`. Ao fim, merge em `develop`.

---

## Estrutura de arquivos (novos/alterados)

```
apps/api/
├─ src/
│  ├─ env.ts                       # + S3_* (opcionais; storage exige em runtime)
│  ├─ db/schema.ts                 # + tabelas proof e audit_event
│  ├─ lib/
│  │  ├─ installment-state.ts      # máquina de estados pura (novo)
│  │  ├─ storage.ts                # S3 client + presignUpload + headObject (novo)
│  │  └─ audit.ts                  # recordEvent (novo)
│  └─ modules/
│     └─ payments.ts               # presign, confirm-upload, confirm, dispute, mark-paid, GET installment (novo)
│  └─ app.ts                       # + .use(paymentsModule)
└─ tests/
   ├─ installment-state.test.ts
   ├─ storage.test.ts              # presign + PUT + head contra MinIO
   └─ payments.test.ts             # fluxo ponta a ponta (com/sem confirmação)
```

---

## Task 1: Env — variáveis de storage (opcionais)

**Files:**
- Modify: `apps/api/src/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Adicionar as vars ao schema em `apps/api/src/env.ts`** (após `GOOGLE_CLIENT_SECRET`)

```ts
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
```

> Opcionais para não quebrar testes que não usam storage; o `lib/storage.ts` exige em runtime.

- [ ] **Step 2: Atualizar `.env.example`** — adicionar na seção `# API`:

```bash
# Storage (R2 em prod; MinIO em dev). forcePathStyle é ligado para MinIO.
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=quitto-proofs
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=minio12345
```

- [ ] **Step 3: Typecheck + commit**

Run: `bun --filter @quitto/api typecheck`
Expected: PASS.

```bash
git add apps/api/src/env.ts .env.example
git commit -m "feat(api): env de storage S3/R2 (opcional)"
```

---

## Task 2: Schema — tabelas `proof` e `audit_event` + migração

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Garantir o import de `jsonb`** no topo de `schema.ts` (adicione à lista de `drizzle-orm/pg-core`)

```ts
  jsonb,
```

- [ ] **Step 2: Adicionar ao fim de `schema.ts`**

```ts
export const proof = pgTable(
  "proof",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installment.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("proof_installment_id_idx").on(table.installmentId)]
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installment.id, {
      onDelete: "cascade",
    }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("audit_event_installment_id_idx").on(table.installmentId)]
);
```

> Tipos de evento (string estável): `proof_submitted`, `payment_confirmed`, `payment_disputed`, `installment_paid`.

- [ ] **Step 3: Gerar e aplicar a migração**

Run (em `apps/api`, com envs): `bun run db:generate && bun run db:migrate`
Expected: cria/aplica `drizzle/0004_*.sql` com `proof` e `audit_event`.

- [ ] **Step 4: Typecheck + commit**

Run: `bun --filter @quitto/api typecheck`

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle
git commit -m "feat(api): tabelas proof e audit_event + migração"
```

---

## Task 3: `lib/installment-state.ts` — máquina de estados pura (TDD)

**Files:**
- Create: `apps/api/src/lib/installment-state.ts`
- Test: `apps/api/tests/installment-state.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/api/tests/installment-state.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { type InstallmentAction, nextStatus } from "../src/lib/installment-state";

const cases: Array<[
  "pending" | "awaiting_confirmation" | "confirmed" | "disputed" | "paid",
  InstallmentAction,
  boolean,
  string,
]> = [
  ["pending", "submit_proof", true, "awaiting_confirmation"],
  ["awaiting_confirmation", "confirm", true, "confirmed"],
  ["awaiting_confirmation", "dispute", true, "disputed"],
  ["disputed", "submit_proof", true, "awaiting_confirmation"],
  ["pending", "submit_proof", false, "paid"],
  ["pending", "mark_paid", false, "paid"],
];

describe("nextStatus", () => {
  for (const [from, action, requiresConfirmation, expected] of cases) {
    it(`${from} --${action}(conf=${requiresConfirmation})--> ${expected}`, () => {
      expect(nextStatus(from, action, requiresConfirmation)).toBe(expected);
    });
  }

  it("rejects confirm when no confirmation is required", () => {
    expect(() => nextStatus("pending", "confirm", false)).toThrow();
  });

  it("rejects confirming an already confirmed installment", () => {
    expect(() => nextStatus("confirmed", "confirm", true)).toThrow();
  });

  it("rejects mark_paid when confirmation is required", () => {
    expect(() => nextStatus("pending", "mark_paid", true)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/installment-state.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/api/src/lib/installment-state.ts`**

```ts
import { ValidationError } from "./errors";

export type InstallmentStatus =
  | "pending"
  | "awaiting_confirmation"
  | "confirmed"
  | "disputed"
  | "paid";

export type InstallmentAction = "submit_proof" | "confirm" | "dispute" | "mark_paid";

/**
 * Pure transition function. `requiresConfirmation` selects the ruleset.
 * Throws ValidationError for illegal transitions.
 */
export function nextStatus(
  current: InstallmentStatus,
  action: InstallmentAction,
  requiresConfirmation: boolean,
): InstallmentStatus {
  if (requiresConfirmation) {
    if (action === "submit_proof" && (current === "pending" || current === "disputed")) {
      return "awaiting_confirmation";
    }
    if (action === "confirm" && current === "awaiting_confirmation") {
      return "confirmed";
    }
    if (action === "dispute" && current === "awaiting_confirmation") {
      return "disputed";
    }
  } else {
    if ((action === "submit_proof" || action === "mark_paid") && current !== "paid") {
      return "paid";
    }
  }
  throw new ValidationError(
    `Transição inválida: ${current} + ${action} (confirmação=${requiresConfirmation})`,
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/installment-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/installment-state.ts apps/api/tests/installment-state.test.ts
git commit -m "feat(api): máquina de estados da parcela (função pura)"
```

---

## Task 4: `lib/storage.ts` — cliente S3 + presign + head

**Files:**
- Create: `apps/api/src/lib/storage.ts`

- [ ] **Step 1: Instalar o SDK**

Run: `cd apps/api && bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
Expected: adicionados ao `apps/api/package.json`.

- [ ] **Step 2: Criar `apps/api/src/lib/storage.ts`**

```ts
import { HeadObjectCommand, type HeadObjectCommandOutput, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

function requireConfig() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!(S3_ENDPOINT && S3_REGION && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)) {
    throw new Error("Storage não configurado: defina as variáveis S3_*");
  }
  return { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY };
}

let client: S3Client | null = null;
function s3(): { client: S3Client; bucket: string } {
  const cfg = requireConfig();
  if (!client) {
    client = new S3Client({
      endpoint: cfg.S3_ENDPOINT,
      region: cfg.S3_REGION,
      credentials: { accessKeyId: cfg.S3_ACCESS_KEY_ID, secretAccessKey: cfg.S3_SECRET_ACCESS_KEY },
      forcePathStyle: true, // necessário para MinIO
    });
  }
  return { client, bucket: cfg.S3_BUCKET };
}

/** Presigned PUT URL for the browser to upload directly. Expires in 5 min. */
export function presignUpload(objectKey: string, contentType: string): Promise<string> {
  const { client: c, bucket } = s3();
  const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType });
  return getSignedUrl(c, command, { expiresIn: 300 });
}

/** Reads object metadata; throws if the object does not exist. */
export function headObject(objectKey: string): Promise<HeadObjectCommandOutput> {
  const { client: c, bucket } = s3();
  return c.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
}
```

- [ ] **Step 3: Escrever o teste de storage (contra MinIO)**

Create `apps/api/tests/storage.test.ts`:

```ts
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "bun:test";
import { env } from "../src/env";
import { headObject, presignUpload } from "../src/lib/storage";

const configured = Boolean(env.S3_ENDPOINT && env.S3_BUCKET);

async function ensureBucket() {
  const c = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: true,
  });
  try {
    await c.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET as string }));
  } catch {
    // bucket já existe — ok
  }
}

describe.if(configured)("storage (MinIO)", () => {
  beforeAll(ensureBucket);

  it("presigns, uploads via PUT and confirms with head", async () => {
    const key = `test/${Date.now()}.txt`;
    const url = await presignUpload(key, "text/plain");
    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    expect(put.ok).toBe(true);
    const head = await headObject(key);
    expect(head.ContentLength).toBe(5);
  });
});
```

> `describe.if(configured)` pula o teste se as envs S3 não estiverem setadas (não quebra quem não subiu MinIO), mas roda de verdade quando estão.

- [ ] **Step 4: Rodar com MinIO de pé + envs**

Run: `bun --filter @quitto/api test tests/storage.test.ts`
Expected: PASS (1 teste) com MinIO; SKIP se sem envs.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/storage.ts apps/api/tests/storage.test.ts apps/api/package.json bun.lock
git commit -m "feat(api): lib/storage (presign + head) S3/R2 com MinIO em dev"
```

---

## Task 5: `lib/audit.ts` — gravar evento de auditoria

**Files:**
- Create: `apps/api/src/lib/audit.ts`

- [ ] **Step 1: Criar `apps/api/src/lib/audit.ts`**

```ts
import { db } from "../db/client";
import { auditEvent } from "../db/schema";

export type AuditType =
  | "proof_submitted"
  | "payment_confirmed"
  | "payment_disputed"
  | "installment_paid";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Appends an immutable audit event. Pass a tx to join an existing transaction. */
export async function recordEvent(
  exec: typeof db | Tx,
  input: {
    contractId: string;
    installmentId?: string;
    actorUserId: string;
    type: AuditType;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await exec.insert(auditEvent).values({
    contractId: input.contractId,
    installmentId: input.installmentId ?? null,
    actorUserId: input.actorUserId,
    type: input.type,
    metadata: input.metadata ?? null,
  });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `bun --filter @quitto/api typecheck`

```bash
git add apps/api/src/lib/audit.ts
git commit -m "feat(api): lib/audit (registro append-only de eventos)"
```

---

## Task 6: `payments.ts` — presign do comprovante

**Files:**
- Create: `apps/api/src/modules/payments.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/payments.test.ts`

- [ ] **Step 1: Criar `apps/api/src/modules/payments.ts` (helpers + presign)**

```ts
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import { presignUpload } from "../lib/storage";
import { requireAuth } from "../lib/session";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Loads installment + parent contract and the caller's role. Throws 404 if no access. */
async function loadInstallmentForUser(userId: string, installmentId: string) {
  const [inst] = await db.select().from(installment).where(eq(installment.id, installmentId)).limit(1);
  if (!inst) {
    throw new NotFoundError("Parcela não encontrada");
  }
  const role = await getContractRole(userId, inst.contractId); // 404 se sem acesso
  const [c] = await db.select().from(contract).where(eq(contract.id, inst.contractId)).limit(1);
  return { inst, contract: c!, role };
}

export const paymentsModule = new Elysia({ prefix: "/api" }).post(
  "/installments/:installmentId/proofs/presign",
  async ({ request, params, body }) => {
    const { user } = await requireAuth(request.headers);
    const { inst, role } = await loadInstallmentForUser(user.id, params.installmentId);
    if (role !== "owner" && role !== "buyer") {
      throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
    }
    const safeName = body.fileName.replace(/[^\w.\-]/g, "_").slice(0, 120);
    const objectKey = `proofs/${inst.contractId}/${inst.id}/${crypto.randomUUID()}-${safeName}`;
    const uploadUrl = await presignUpload(objectKey, body.mimeType);
    return { uploadUrl, objectKey };
  },
  {
    params: t.Object({ installmentId: t.String() }),
    body: t.Object({
      fileName: t.String({ minLength: 1, maxLength: 200 }),
      mimeType: t.Union(ALLOWED_MIME.map((m) => t.Literal(m))),
    }),
    response: t.Object({ uploadUrl: t.String(), objectKey: t.String() }),
  },
);
```

- [ ] **Step 2: Registrar no `app.ts`**

```ts
import { paymentsModule } from "./modules/payments";
```
No `buildApp`, após `.use(contractsModule)`:
```ts
    .use(contractsModule)
    .use(paymentsModule);
```

- [ ] **Step 3: Escrever o teste base (helpers + presign) em `apps/api/tests/payments.test.ts`**

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

const configured = Boolean(process.env.S3_ENDPOINT);

async function signUpCookie(tag: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "T", email: `${tag}-${Date.now()}@e.com`, password: "password123" }),
    }),
  );
  return (res.headers.get("set-cookie") as string).split(";")[0] as string;
}

async function createContract(cookie: string, requiresConfirmation: boolean) {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "C",
        ownerRole: "buyer",
        requiresConfirmation,
        schedule: { mode: "auto", totalAmountCents: 3000, installmentsCount: 3, firstDueDate: "2026-07-10" },
      }),
    }),
  );
  return (await res.json()).id as string;
}

async function firstInstallmentId(cookie: string, contractId: string): Promise<string> {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, { headers: { cookie } }),
  );
  return (await res.json()).installments[0].id as string;
}

describe.if(configured)("POST presign", () => {
  it("retorna uploadUrl + objectKey para o dono", async () => {
    const cookie = await signUpCookie("presign");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/proofs/presign`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ fileName: "comprovante.pdf", mimeType: "application/pdf" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toContain("http");
    expect(body.objectKey).toContain(`/${iId}/`);
  });
});
```

- [ ] **Step 4: Rodar com MinIO + envs**

Run: `bun --filter @quitto/api test tests/payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments.ts apps/api/src/app.ts apps/api/tests/payments.test.ts
git commit -m "feat(api): presign de comprovante (RBAC + MIME whitelist)"
```

---

## Task 7: Confirmar upload — cria `proof`, transiciona, audita

**Files:**
- Modify: `apps/api/src/modules/payments.ts`
- Test: `apps/api/tests/payments.test.ts`

- [ ] **Step 1: Adicionar imports no topo de `payments.ts`** (combine com os existentes)

```ts
import { proof, installment } from "../db/schema";
import { headObject } from "../lib/storage";
import { nextStatus } from "../lib/installment-state";
import { recordEvent } from "../lib/audit";
import { ValidationError } from "../lib/errors";
```

- [ ] **Step 2: Encadear o handler de confirmação após o presign**

```ts
  .post(
    "/installments/:installmentId/proofs",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const { inst, contract: c, role } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "buyer") {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }

      // valida que o objeto realmente subiu (e tamanho/tipo coerentes)
      const head = await headObject(body.objectKey).catch(() => null);
      if (!head) {
        throw new ValidationError("Comprovante não encontrado no storage");
      }
      const sizeBytes = head.ContentLength ?? 0;
      if (sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
        throw new ValidationError("Arquivo inválido (vazio ou maior que 10MB)");
      }

      const newStatus = nextStatus(inst.status, "submit_proof", c.requiresConfirmation);

      await db.transaction(async (tx) => {
        await tx.insert(proof).values({
          installmentId: inst.id,
          objectKey: body.objectKey,
          fileName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes,
          uploadedBy: user.id,
        });
        await tx
          .update(installment)
          .set({
            status: newStatus,
            ...(newStatus === "paid" ? { paidAt: new Date() } : {}),
          })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: c.requiresConfirmation ? "proof_submitted" : "installment_paid",
          metadata: { fileName: body.fileName },
        });
      });

      return { status: newStatus };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      body: t.Object({
        objectKey: t.String({ minLength: 1 }),
        fileName: t.String({ minLength: 1, maxLength: 200 }),
        mimeType: t.Union(ALLOWED_MIME.map((m) => t.Literal(m))),
      }),
      response: t.Object({ status: t.String() }),
    },
  )
```

- [ ] **Step 3: Adicionar teste do fluxo COM confirmação (sobe arquivo real no MinIO)**

Acrescente em `payments.test.ts`:

```ts
async function uploadProof(cookie: string, installmentId: string) {
  const presign = await (
    await app.handle(
      new Request(`http://localhost/api/installments/${installmentId}/proofs/presign`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ fileName: "c.pdf", mimeType: "application/pdf" }),
      }),
    )
  ).json();
  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: "%PDF-1.4 fake",
  });
  return app.handle(
    new Request(`http://localhost/api/installments/${installmentId}/proofs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ objectKey: presign.objectKey, fileName: "c.pdf", mimeType: "application/pdf" }),
    }),
  );
}

describe.if(configured)("confirm upload (com confirmação)", () => {
  it("envia comprovante e vai para awaiting_confirmation", async () => {
    const cookie = await signUpCookie("up1");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await uploadProof(cookie, iId);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("awaiting_confirmation");
  });
});

describe.if(configured)("confirm upload (sem confirmação)", () => {
  it("envia comprovante e já fica paid", async () => {
    const cookie = await signUpCookie("up2");
    const cId = await createContract(cookie, false);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await uploadProof(cookie, iId);
    expect((await res.json()).status).toBe("paid");
  });
});
```

- [ ] **Step 4: Rodar com MinIO + envs**

Run: `bun --filter @quitto/api test tests/payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments.ts apps/api/tests/payments.test.ts
git commit -m "feat(api): confirma upload (cria proof + transição + auditoria)"
```

---

## Task 8: Ações de confirmação — `confirm`, `dispute`, `mark-paid`

**Files:**
- Modify: `apps/api/src/modules/payments.ts`
- Test: `apps/api/tests/payments.test.ts`

- [ ] **Step 1: Encadear os três handlers após o confirm-upload**

```ts
  .post(
    "/installments/:installmentId/confirm",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { inst, contract: c, role } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "seller") {
        throw new ForbiddenError("Apenas o vendedor/dono confirma");
      }
      const newStatus = nextStatus(inst.status, "confirm", c.requiresConfirmation);
      await db.transaction(async (tx) => {
        await tx
          .update(installment)
          .set({ status: newStatus, confirmedAt: new Date(), paidAt: new Date() })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "payment_confirmed",
        });
      });
      return { status: newStatus };
    },
    { params: t.Object({ installmentId: t.String() }), response: t.Object({ status: t.String() }) },
  )
  .post(
    "/installments/:installmentId/dispute",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const { inst, contract: c, role } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "seller") {
        throw new ForbiddenError("Apenas o vendedor/dono contesta");
      }
      const newStatus = nextStatus(inst.status, "dispute", c.requiresConfirmation);
      await db.transaction(async (tx) => {
        await tx.update(installment).set({ status: newStatus }).where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "payment_disputed",
          metadata: body.reason ? { reason: body.reason } : undefined,
        });
      });
      return { status: newStatus };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      body: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }),
      response: t.Object({ status: t.String() }),
    },
  )
  .post(
    "/installments/:installmentId/mark-paid",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { inst, contract: c, role } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "buyer") {
        throw new ForbiddenError("Apenas o comprador/dono marca como paga");
      }
      const newStatus = nextStatus(inst.status, "mark_paid", c.requiresConfirmation);
      await db.transaction(async (tx) => {
        await tx
          .update(installment)
          .set({ status: newStatus, paidAt: new Date() })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "installment_paid",
        });
      });
      return { status: newStatus };
    },
    { params: t.Object({ installmentId: t.String() }), response: t.Object({ status: t.String() }) },
  )
```

- [ ] **Step 2: Adicionar testes (confirm após upload; dispute; mark-paid sem confirmação)**

```ts
describe.if(configured)("confirm/dispute", () => {
  it("vendedor/dono confirma após o upload", async () => {
    const cookie = await signUpCookie("cf");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    await uploadProof(cookie, iId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/confirm`, {
        method: "POST",
        headers: { cookie },
      }),
    );
    expect((await res.json()).status).toBe("confirmed");
  });

  it("rejeita confirmar uma parcela ainda pendente (transição inválida -> 422)", async () => {
    const cookie = await signUpCookie("cf2");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/confirm`, {
        method: "POST",
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 3: Rodar com MinIO + envs**

Run: `bun --filter @quitto/api test tests/payments.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/payments.ts apps/api/tests/payments.test.ts
git commit -m "feat(api): ações confirm/dispute/mark-paid com auditoria"
```

---

## Task 9: `GET /api/installments/:installmentId` — detalhe (proofs + auditoria)

> Para o drawer da 3b: comprovantes (com URL de download assinada) + timeline da auditoria.

**Files:**
- Modify: `apps/api/src/modules/payments.ts`
- Modify: `apps/api/src/lib/storage.ts` (adicionar `presignDownload`)
- Test: `apps/api/tests/payments.test.ts`

- [ ] **Step 1: Adicionar `presignDownload` em `lib/storage.ts`**

Adicione o import do `GetObjectCommand` (na linha do `@aws-sdk/client-s3`) e a função:

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";

/** Presigned GET URL for download (private bucket). Expires in 5 min. */
export function presignDownload(objectKey: string): Promise<string> {
  const { client: c, bucket } = s3();
  return getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 300 });
}
```

- [ ] **Step 2: Encadear o GET em `payments.ts`** (imports `proof`, `auditEvent`, `presignDownload`, `desc`)

No topo (combine com existentes):
```ts
import { desc } from "drizzle-orm";
import { auditEvent } from "../db/schema";
import { presignDownload } from "../lib/storage";
```

Handler:
```ts
  .get(
    "/installments/:installmentId",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { inst } = await loadInstallmentForUser(user.id, params.installmentId); // 404 se sem acesso

      const proofs = await db.select().from(proof).where(eq(proof.installmentId, inst.id));
      const events = await db
        .select()
        .from(auditEvent)
        .where(eq(auditEvent.installmentId, inst.id))
        .orderBy(desc(auditEvent.createdAt));

      const proofsOut = await Promise.all(
        proofs.map(async (p) => ({
          id: p.id,
          fileName: p.fileName,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          downloadUrl: await presignDownload(p.objectKey),
          createdAt: p.createdAt.toISOString(),
        })),
      );

      return {
        id: inst.id,
        sequence: inst.sequence,
        amountCents: inst.amountCents,
        dueDate: inst.dueDate,
        status: inst.status,
        proofs: proofsOut,
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      response: t.Object({
        id: t.String(),
        sequence: t.Integer(),
        amountCents: t.Integer(),
        dueDate: t.String(),
        status: t.String(),
        proofs: t.Array(
          t.Object({
            id: t.String(),
            fileName: t.String(),
            mimeType: t.String(),
            sizeBytes: t.Integer(),
            downloadUrl: t.String(),
            createdAt: t.String(),
          }),
        ),
        events: t.Array(t.Object({ id: t.String(), type: t.String(), createdAt: t.String() })),
      }),
    },
  )
```

- [ ] **Step 3: Teste do detalhe (após upload tem 1 proof e eventos)**

```ts
describe.if(configured)("GET installment detail", () => {
  it("traz proofs com downloadUrl e a timeline de eventos", async () => {
    const cookie = await signUpCookie("det");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    await uploadProof(cookie, iId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}`, { headers: { cookie } }),
    );
    const body = await res.json();
    expect(body.proofs).toHaveLength(1);
    expect(body.proofs[0].downloadUrl).toContain("http");
    expect(body.events.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 4: Rodar com MinIO + envs**

Run: `bun --filter @quitto/api test tests/payments.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments.ts apps/api/src/lib/storage.ts apps/api/tests/payments.test.ts
git commit -m "feat(api): GET detalhe da parcela (proofs assinados + timeline)"
```

---

## Task 10: Fechar a fase — CI (MinIO), suite, Eden e merge

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Adicionar o serviço MinIO + envs S3 no CI**

Em `.github/workflows/ci.yml`, adicione um service MinIO ao job e as envs `S3_*` (apontando para ele). Service:

```yaml
      minio:
        image: bitnami/minio:latest
        env:
          MINIO_ROOT_USER: minio
          MINIO_ROOT_PASSWORD: minio12345
          MINIO_DEFAULT_BUCKETS: quitto-proofs
        ports: ["9000:9000"]
```

E no bloco `env:` do job, acrescente:
```yaml
      S3_ENDPOINT: http://localhost:9000
      S3_REGION: us-east-1
      S3_BUCKET: quitto-proofs
      S3_ACCESS_KEY_ID: minio
      S3_SECRET_ACCESS_KEY: minio12345
```

- [ ] **Step 2: Suite + lint + typecheck + build (local, com Postgres e MinIO + envs)**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde (testes de storage/payments rodam de verdade).

- [ ] **Step 3: Eden continua tipando**

Run: `bun --filter @quitto/web test`
Expected: PASS — novos endpoints (`api.api.installments[...]`) tipados.

- [ ] **Step 4: Merge em `develop` + roadmap**

```bash
git checkout develop
git merge --no-ff feat/fase-3a-pagamento-api -m "Merge da Fase 3a (pagamento/comprovantes API) em develop"
```
Marque a Fase 3a no ROADMAP (e ajuste a linha da Fase 3 para o split 3a/3b), commit:
```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca a Fase 3a (pagamento API) como concluída"
```

---

## Self-Review (cobertura)

- **Upload pré-assinado (R2/MinIO):** Tasks 1, 4, 6 ✅
- **Máquina de estados (com/sem confirmação), função pura testada:** Task 3; aplicada em 7, 8 ✅
- **Comprovante validado (existe no storage, tamanho/MIME):** Tasks 6 (MIME), 7 (head/size) ✅
- **Trilha de auditoria append-only:** Tasks 2, 5; eventos em 7, 8 ✅
- **RBAC (comprador/dono anexa; vendedor/dono confirma/contesta):** Tasks 6, 7, 8 ✅
- **Detalhe da parcela p/ o drawer (proofs assinados + timeline):** Task 9 ✅
- **CI exercita o storage (MinIO):** Task 10 ✅
- **Bucket privado + download por URL assinada de curta duração:** Task 9 (`presignDownload`, 5 min) ✅
- **Fora de escopo (3b):** UI do drawer (upload, botões confirmar/contestar, timeline), que consome estes endpoints.

> **Observação:** `crypto.randomUUID()` é global no runtime Bun/Node — sem import. Datas via `new Date()` são permitidas no código de produção (a proibição vale só para scripts de workflow).
