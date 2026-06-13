# Fixes pós-Fase 4b (participantes/UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tarefa a tarefa. Steps usam checkbox (`- [ ]`). Siga clean-arch (spec §9): constantes de `@quitto/shared`, rótulos em `lib/labels`, lógica em hooks, sem literais de domínio, sem Context API.

**Goal:** Corrigir 8 itens reportados em uso após a 4b (`BUGS.md`, lote 2026-06-13): cursor do card, datepicker no drawer de parcela, foco cortado no drawer, select com estilo próprio, papel do dono, unicidade de papéis, fundir adicionar+convidar, e restringir papel do dono a comprador/vendedor.

**Architecture:** Maioria é UI (`apps/web`). B5/B6/B8 mexem no modelo de domínio de papéis: o dono passa a ocupar um slot **comprador/vendedor** (não mais "dono"), buyer/seller são únicos por contrato, viewer repete; RBAC continua derivando o dono de `contract.ownerId`. B4 adiciona um `Select` (Radix, estilo shadcn). B7 funde adicionar+convidar num passo.

**Tech Stack:** React 19 + TanStack Router/Query + RHF + Zod + Radix + Tailwind (web); Elysia + TypeBox + Drizzle (api); `bun test` / `vitest`.

> **Pré-requisitos:** branch `fix/participantes-ui-2026-06-13` a partir de `develop`. Postgres + MinIO de pé. Commit por tarefa. Ao fim, suite verde → merge em `develop`.

---

## Decisões de design (confirme antes de executar; tudo reversível)

- **B5 (papel do dono):** o dono passa a ser inserido como `participant` com `role = ownerRole` (comprador/vendedor), não mais `"owner"`. A identidade de dono vem de um flag novo `isOwner` no detalhe do contrato (`participant.linkedUserId === contract.ownerId`). UI mostra o papel real; ações de gestão (remover/convidar) são bloqueadas por `isOwner` (não mais por `role === "owner"`). Migração faz backfill dos donos existentes (buyer/seller); donos legados "neutral" ficam como estão (dado de dev).
- **B6 (unicidade):** comprador e vendedor são **únicos** por contrato; convidado (viewer) é ilimitado. A API valida (422 se papel único já ocupado) e a UI só oferece papéis livres.
- **B7 (adicionar+convidar):** o form de adicionar passa a ter **e-mail**; ao salvar, cria o participante **e** o convite num passo, exibindo o link. O e-mail é obrigatório no adicionar. Slots já existentes não-vinculados mantêm um "Gerar novo link".
- **B8 (papel do dono na criação):** wizard e schema passam a oferecer **só comprador/vendedor**. `OWNER_ROLE.neutral` continua no enum do banco (sem migração), apenas deixa de ser selecionável.

---

## Estrutura de arquivos (novos/alterados)

```
apps/web/src/
├─ components/ui/select.tsx          # NOVO — Select (Radix, shadcn-style)
├─ components/add-participant-form.tsx  # B6/B7 — Select, papéis livres, e-mail+convite
├─ components/participants-drawer.tsx   # B3/B5/B6/B7 — padding foco, isOwner, papéis livres
├─ components/installment-drawer.tsx    # B2 — DateField no lugar do Input
├─ routes/contract-detail.tsx           # B1 cursor, B5 isOwner
├─ routes/contract-new.tsx              # B4 Select, B8 só buyer/seller
└─ lib/labels.ts                        # (sem mudança obrigatória)
apps/api/src/
├─ modules/contracts.ts                 # B5 (role=ownerRole + isOwner no detalhe), B8 (TypeBox)
├─ modules/participants.ts              # B6 (unicidade), B5 (guards por ownerId)
└─ db/migrations                        # B5 — backfill do papel do dono
packages/shared/src/index.ts            # B8 — ownerRoleSchema só buyer/seller
```

---

## Task 1: B1 — `cursor-pointer` no card de parcela

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx`

- [ ] **Step 1: Adicionar `cursor-pointer` ao `<button>` do card** (na lista de parcelas; hoje a classe começa em `"relative flex w-full items-center gap-3 overflow-hidden rounded-xl border ..."`). Acrescente `cursor-pointer`:

```tsx
                <button
                  className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => setOpenId(it.id)}
                  type="button"
                >
```

- [ ] **Step 2: Verificar + commit**

Run: `bun --filter @quitto/web lint && bun --filter @quitto/web typecheck`
Expected: exit 0.

```bash
git add apps/web/src/routes/contract-detail.tsx
git commit -m "fix(web): cursor-pointer no card de parcela (B1)"
```

---

## Task 2: B2 — DateField no drawer de edição de parcela

**Files:**
- Modify: `apps/web/src/components/installment-drawer.tsx`

`InstallmentEditForm` usa `FormProvider` + RHF; `DateField` (`apps/web/src/components/date-field.tsx`) lê via `useFormContext` e guarda ISO. `buildInstallmentPatch` já ignora `dueDate` vazio (`if (values.dueDate)`), então deixar o campo vazio = não enviar continua valendo.

- [ ] **Step 1: Importar `DateField`** (topo de `installment-drawer.tsx`, junto dos outros imports de componentes):

```tsx
import { DateField } from "@/components/date-field";
```

- [ ] **Step 2: Trocar o bloco do campo "Vencimento"** dentro de `InstallmentEditForm`. Hoje é:

```tsx
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="due">Vencimento</Label>
          <Input
            id="due"
            placeholder="AAAA-MM-DD"
            {...form.register("dueDate", {
              setValueAs: (v) => (v === "" ? undefined : v),
            })}
          />
          {form.formState.errors.dueDate ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.dueDate.message}
            </p>
          ) : null}
        </div>
```

Troque por:

```tsx
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="due">Vencimento</Label>
          <DateField id="due" name="dueDate" />
          {form.formState.errors.dueDate ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.dueDate.message}
            </p>
          ) : null}
        </div>
```

Se o `Input` ficar sem uso no arquivo após a troca, remova o import dele.

- [ ] **Step 3: Verificar (o teste existente do drawer ainda passa) + commit**

Run: `bun --filter @quitto/web test installment` (ou o arquivo de teste do drawer/parcela) e `bun --filter @quitto/web typecheck`
Expected: PASS / exit 0. Se algum teste digitava no campo via `placeholder="AAAA-MM-DD"`, ajuste-o para o novo `placeholder="dd/mm/aaaa"` do `DateField` (digite no formato BR).

```bash
git add apps/web/src/components/installment-drawer.tsx apps/web/tests
git commit -m "fix(web): datepicker/máscara no vencimento do drawer de parcela (B2)"
```

---

## Task 3: B4 — Componente `Select` (Radix, estilo shadcn) + adoção

**Files:**
- Create: `apps/web/src/components/ui/select.tsx`
- Modify: `apps/web/src/routes/contract-new.tsx`
- (B6/B7 trocam o select do `add-participant-form` na Task 7 — aqui só o do wizard.)

`radix-ui` já é dependência (import: `import { Select as SelectPrimitive } from "radix-ui";`). Os componentes do projeto seguem o padrão de `apps/web/src/components/ui/dialog.tsx`/`sheet.tsx` (export de wrappers tipados + `cn`).

- [ ] **Step 1: Criar `apps/web/src/components/ui/select.tsx`**

```tsx
import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in z-50 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex items-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}
```

> Confirme que `bg-popover`/`text-popover-foreground` existem no tema (Tailwind v4 + tokens shadcn). Se não, troque por `bg-background`/`text-foreground` (já usados em `dialog.tsx`/`sheet.tsx`).

- [ ] **Step 2: Usar no wizard `contract-new.tsx`** — troque o `<select>` nativo de "Meu papel". Hoje (≈ linhas 84-95):

```tsx
        <Label htmlFor="ownerRole">Meu papel</Label>
        <select id="ownerRole" {...register("ownerRole")} ...>
          {Object.values(OWNER_ROLE).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
```

`ownerRole` é controlado via `register`; com Radix Select use `Controller`. Importe no topo:

```tsx
import { Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRACT_OWNER_ROLES } from "@quitto/shared"; // definido na Task 5
```

E o bloco do campo:

```tsx
        <Label htmlFor="ownerRole">Meu papel</Label>
        <Controller
          control={control}
          name="ownerRole"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="ownerRole">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_OWNER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
```

`control` vem do `useFormContext`/`useForm` já usado no arquivo (o wizard usa RHF). Garanta que `control` esteja desestruturado do form. **Nota:** esta task depende da Task 5 (que define `CONTRACT_OWNER_ROLES`). Se executar antes, use `[OWNER_ROLE.buyer, OWNER_ROLE.seller]` inline e troque depois.

- [ ] **Step 3: Verificar + commit**

Run: `bun --filter @quitto/web lint && bun --filter @quitto/web typecheck && bun --filter @quitto/web test contract-new`
Expected: PASS. Ajuste o teste do wizard se ele selecionava papel via `<select>` (agora é Radix: selecione via clique no trigger + item, ou via `Controller` default).

```bash
git add apps/web/src/components/ui/select.tsx apps/web/src/routes/contract-new.tsx apps/web/tests
git commit -m "feat(web): componente Select (Radix) + adoção no wizard (B4)"
```

---

## Task 4: B3 — folga lateral no drawer de participantes (foco não cortado)

**Files:**
- Modify: `apps/web/src/components/participants-drawer.tsx`

O container rolável (`<div className="flex flex-1 flex-col gap-4 overflow-y-auto">`) corta o `ring-2` dos inputs colados às bordas. Dar folga horizontal resolve.

- [ ] **Step 1: Adicionar padding horizontal compensado ao container rolável**

Troque:

```tsx
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
```

por:

```tsx
        <div className="-mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1">
```

(`px-1` dá espaço pro anel de foco; `-mx-1` compensa para o alinhamento com o cabeçalho não mudar.)

- [ ] **Step 2: Verificar visualmente + commit**

Run: `bun --filter @quitto/web lint && bun --filter @quitto/web typecheck`
Expected: exit 0. (Verificação visual: focar um input no drawer não corta mais o anel.)

```bash
git add apps/web/src/components/participants-drawer.tsx
git commit -m "fix(web): folga lateral no drawer de participantes (B3)"
```

---

## Task 5: B8 — papel do dono só comprador/vendedor (schema + API)

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/modules/contracts.ts`

- [ ] **Step 1: Em `packages/shared/src/index.ts`, restringir `ownerRoleSchema` e exportar a tupla** — troque:

```ts
export const ownerRoleSchema = z.enum(OWNER_ROLES);
```

por:

```ts
/** Papéis que o dono pode ter ao criar um contrato (neutral fica fora do produto). */
export const CONTRACT_OWNER_ROLES = [
  OWNER_ROLE.buyer,
  OWNER_ROLE.seller,
] as const;
export const ownerRoleSchema = z.enum(CONTRACT_OWNER_ROLES);
```

`OWNER_ROLE` já é importado no topo do arquivo (`import { OWNER_ROLES, PARTICIPANT_ROLE } from "./domain";` — adicione `OWNER_ROLE`: `import { OWNER_ROLE, OWNER_ROLES, PARTICIPANT_ROLE } from "./domain";`; mantenha `OWNER_ROLES` se ainda usado pelo pgEnum via re-export).

- [ ] **Step 2: Em `apps/api/src/modules/contracts.ts`, remover `neutral` do TypeBox** — troque:

```ts
  ownerRole: t.Union([
    t.Literal("buyer"),
    t.Literal("seller"),
    t.Literal("neutral"),
  ]),
```

por:

```ts
  ownerRole: t.Union([t.Literal("buyer"), t.Literal("seller")]),
```

- [ ] **Step 3: Teste de rejeição** — em `apps/api/tests/contracts.test.ts`, adicione um caso que criar com `ownerRole: "neutral"` retorna 422:

```ts
it("rejeita ownerRole neutral na criação (422)", async () => {
  const c = await cookie(`neu-${Date.now()}`); // use o helper de cookie do arquivo
  const r = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: c },
      body: JSON.stringify({
        title: "C",
        ownerRole: "neutral",
        requiresConfirmation: false,
        schedule: { mode: "auto", totalAmountCents: 3000, installmentsCount: 3, firstDueDate: "2026-07-10" },
      }),
    })
  );
  expect(r.status).toBe(422);
});
```

(Use o nome real do helper de cookie do `contracts.test.ts`.)

- [ ] **Step 4: Rodar + commit**

Run: `bun --filter @quitto/shared typecheck && bun --filter @quitto/api test tests/contracts.test.ts`
Expected: PASS.

```bash
git add packages/shared/src/index.ts apps/api/src/modules/contracts.ts apps/api/tests/contracts.test.ts
git commit -m "fix: papel do dono restrito a comprador/vendedor (B8)"
```

---

## Task 6: B5 — dono ocupa slot comprador/vendedor (não "dono")

**Files:**
- Modify: `apps/api/src/modules/contracts.ts` (create + detalhe `isOwner`)
- Modify: `apps/api/src/modules/participants.ts` (guards por ownerId)
- Create: migração de backfill (Drizzle)
- Modify: `apps/web/src/routes/contract-detail.tsx` (usa `isOwner`)
- Modify: `apps/web/src/components/participants-drawer.tsx` (usa `isOwner`)
- Test: `apps/api/tests/contracts.test.ts`, `apps/api/tests/participants.test.ts`

- [ ] **Step 1: No create (`contracts.ts`), inserir o dono com o papel real.** Importe `PARTICIPANT_ROLE` se ainda não estiver (`import { PARTICIPANT_ROLE } from "@quitto/shared";`). Troque:

```ts
        await tx.insert(participant).values({
          contractId,
          displayName: user.name,
          role: "owner",
          linkedUserId: user.id,
        });
```

por:

```ts
        await tx.insert(participant).values({
          contractId,
          displayName: user.name,
          role: body.ownerRole, // dono ocupa o slot comprador/vendedor
          linkedUserId: user.id,
        });
```

- [ ] **Step 2: No detalhe do contrato (`contracts.ts`), adicionar `isOwner`** ao mapeamento e ao schema dos participantes. O contrato carrega `ownerId`; compare com `linkedUserId`. No `.map` dos participantes:

```ts
        participants: people.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          role: p.role,
          linked: p.linkedUserId !== null,
          isOwner: p.linkedUserId === row.ownerId, // `row` = a linha do contrato carregada no handler
        })),
```

E no `response` do detalhe, no objeto de participante, acrescente `isOwner: t.Boolean()`:

```ts
        participants: t.Array(
          t.Object({
            id: t.String(),
            displayName: t.String(),
            role: t.String(),
            linked: t.Boolean(),
            isOwner: t.Boolean(),
          })
        ),
```

> Confirme o nome da variável da linha do contrato no handler (ex.: `row`/`c`/`contractRow`) e que `ownerId` está selecionado. Se não estiver, inclua `ownerId` no `select`.

- [ ] **Step 3: Em `participants.ts`, trocar os guards de `role === "owner"` por ownerId.** Hoje o DELETE faz:

```ts
      if (target.role === PARTICIPANT_ROLE.owner) {
        throw new ForbiddenError("O dono não pode ser removido");
      }
```

Como o dono agora tem papel buyer/seller, carregue o contrato e compare `linkedUserId` com `ownerId`. Substitua o guard por:

```ts
      const [c] = await db
        .select({ ownerId: contract.ownerId })
        .from(contract)
        .where(eq(contract.id, params.id))
        .limit(1);
      if (target.linkedUserId && c && target.linkedUserId === c.ownerId) {
        throw new ForbiddenError("O dono não pode ser removido");
      }
```

> Importe `contract` de `../db/schema` se ainda não importado.

- [ ] **Step 4: Migração de backfill** — gere uma migração SQL (em `apps/api`, com envs): `bun run db:generate --name backfill_owner_participant_role` **ou** crie um arquivo SQL manual em `apps/api/drizzle` com:

```sql
UPDATE participant p
SET role = c.owner_role
FROM contract c
WHERE p.contract_id = c.id
  AND p.linked_user_id = c.owner_id
  AND p.role = 'owner'
  AND c.owner_role IN ('buyer', 'seller');
```

Aplique: `bun run db:migrate`. (Donos legados com `owner_role = 'neutral'` ficam como `role='owner'` — dado de dev, aceitável; `participant_role` enum não tem `neutral`.)

- [ ] **Step 5: UI — `contract-detail.tsx` usa `isOwner` para gating.** Hoje gera o botão "Gerenciar" e o `ParticipantsDrawer` com base em `data.role === PARTICIPANT_ROLE.owner` — isso continua certo (o `data.role` vem do RBAC por `ownerId`, não muda). **Nenhuma** mudança obrigatória aqui além de garantir que a lista read-only exibe `ROLE_LABEL[p.role]` (já faz) — agora mostrará comprador/vendedor para o dono. (Opcional: um marcador discreto "você" no item `p.isOwner`.)

- [ ] **Step 6: UI — `participants-drawer.tsx` usa `isOwner` em vez de `role === owner`.** O tipo `ParticipantView` ganha `isOwner: boolean`. Onde hoje há `const isOwner = participant.role === PARTICIPANT_ROLE.owner;`, troque por `const isOwner = participant.isOwner;`. Os botões "Convidar"/"Remover" continuam escondidos quando `isOwner`. Propague `isOwner` no tipo passado por `contract-detail.tsx` → `ParticipantsDrawer` (o `participants` do detalhe já trará o campo).

- [ ] **Step 7: Testes** — em `apps/api/tests/contracts.test.ts`, asserte que o detalhe traz o dono com `role` = ownerRole e `isOwner: true`:

```ts
it("dono aparece com seu papel (não 'owner') e isOwner=true", async () => {
  const c = await cookie(`own-${Date.now()}`);
  const id = await newContract(c); // helper existente; ownerRole "buyer"
  const detail = await (await app.handle(new Request(`http://localhost/api/contracts/${id}`, { headers: { cookie: c } }))).json();
  const me = detail.participants.find((p: { isOwner: boolean }) => p.isOwner);
  expect(me).toBeTruthy();
  expect(me.role).toBe("buyer");
});
```

Em `apps/api/tests/participants.test.ts`, ajuste qualquer teste que assumia o dono com `role: "owner"`.

- [ ] **Step 8: Rodar + commit**

Run: `bun --filter @quitto/api test && bun --filter @quitto/web typecheck`
Expected: PASS.

```bash
git add apps/api/src/modules/contracts.ts apps/api/src/modules/participants.ts apps/api/drizzle apps/web/src/components/participants-drawer.tsx apps/web/src/routes/contract-detail.tsx apps/api/tests
git commit -m "fix: dono ocupa slot comprador/vendedor + isOwner no detalhe (B5)"
```

---

## Task 7: B6 + B7 — unicidade de papéis e adicionar+convidar num passo

**Files:**
- Modify: `apps/api/src/modules/participants.ts` (unicidade no add)
- Modify: `apps/web/src/components/add-participant-form.tsx` (Select, papéis livres, e-mail + convite)
- Modify: `apps/web/src/components/participants-drawer.tsx` (passa papéis livres; remove fluxo duplicado)
- Test: `apps/api/tests/participants.test.ts`, `apps/web/tests/...`

- [ ] **Step 1: API — validar unicidade no add (`participants.ts`).** No handler de `POST /contracts/:id/participants`, antes do insert, se `body.role` for buyer ou seller, rejeite se já existir participante com esse papel:

```ts
      if (
        body.role === PARTICIPANT_ROLE.buyer ||
        body.role === PARTICIPANT_ROLE.seller
      ) {
        const [taken] = await db
          .select({ id: participant.id })
          .from(participant)
          .where(
            and(
              eq(participant.contractId, params.id),
              eq(participant.role, body.role)
            )
          )
          .limit(1);
        if (taken) {
          throw new ValidationError("Este papel já está ocupado");
        }
      }
```

Importe `ValidationError` de `../lib/errors` e `and`/`eq` de `drizzle-orm` se faltarem.

- [ ] **Step 2: API — teste de unicidade.** Em `apps/api/tests/participants.test.ts`:

```ts
it("rejeita segundo vendedor (422); convidado pode repetir (200)", async () => {
  const owner = await cookie(`uniq-${Date.now()}`);
  const id = await newContract(owner); // ownerRole buyer
  const add = (role: string, name: string) =>
    app.handle(new Request(`http://localhost/api/contracts/${id}/participants`, {
      method: "POST", headers: { "content-type": "application/json", cookie: owner },
      body: JSON.stringify({ displayName: name, role }),
    }));
  expect((await add("seller", "V1")).status).toBe(200);
  expect((await add("seller", "V2")).status).toBe(422);
  expect((await add("viewer", "C1")).status).toBe(200);
  expect((await add("viewer", "C2")).status).toBe(200);
});
```

- [ ] **Step 3: Web — `add-participant-form.tsx`: papéis livres + Select + e-mail + convite num passo.** Reescreva o componente. Ele recebe os papéis disponíveis e o `contractId`, usa o `Select` da Task 3, coleta `displayName` + `role` + `email`, e ao salvar chama add **e** invite, devolvendo o token ao pai para exibir o link. Props novas: `availableRoles: ParticipantRole[]`. Esquema de form local (zod) estende o `addParticipantSchema` com `email`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createInviteSchema,
  type ParticipantRole,
  PARTICIPANT_ROLE,
} from "@quitto/shared";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddParticipantMutation,
  useCreateInviteMutation,
} from "@/hooks/use-participant-mutations";
import { ROLE_LABEL } from "@/lib/labels";

const formSchema = z.object({
  displayName: z.string().trim().min(1, "Informe um nome").max(120, "Máx. 120"),
  role: z.string().min(1),
  email: createInviteSchema.shape.email,
});
type FormValues = z.infer<typeof formSchema>;

export function AddParticipantForm({
  contractId,
  availableRoles,
  onCreated,
  onDone,
}: {
  contractId: string;
  availableRoles: ParticipantRole[];
  onCreated: (token: string) => void;
  onDone: () => void;
}) {
  const addMutation = useAddParticipantMutation(contractId);
  const inviteMutation = useCreateInviteMutation(contractId);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: "", role: availableRoles[0] ?? PARTICIPANT_ROLE.viewer, email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const created = await addMutation.mutateAsync({
      displayName: values.displayName,
      role: values.role as ParticipantRole,
    });
    const invite = await inviteMutation.mutateAsync({
      participantId: created.id,
      body: { email: values.email },
    });
    form.reset();
    onCreated(invite.token);
    onDone();
  });

  const pending = addMutation.isPending || inviteMutation.isPending;

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-name">Nome</Label>
        <Input id="participant-name" placeholder="Ex.: Irmão" {...form.register("displayName")} />
        {form.formState.errors.displayName ? (
          <p className="text-destructive text-xs">{form.formState.errors.displayName.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-role">Papel</Label>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="participant-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-email">E-mail do convidado</Label>
        <Input id="participant-email" placeholder="pessoa@exemplo.com" type="email" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending} type="submit">
          {pending ? "Adicionando…" : "Adicionar e gerar convite"}
        </Button>
        <Button onClick={onDone} type="button" variant="outline">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Web — `participants-drawer.tsx`: calcular papéis livres e exibir o link após adicionar.** No `ParticipantsDrawer`, derive os papéis disponíveis a partir de `participants` (buyer/seller ocupados saem; viewer sempre disponível) e guarde o token recém-criado para mostrar o link:

```tsx
import {
  INVITABLE_PARTICIPANT_ROLES,
  type ParticipantRole,
  PARTICIPANT_ROLE,
} from "@quitto/shared";
// ...
  const takenUnique = new Set(
    participants
      .filter((p) => p.role === PARTICIPANT_ROLE.buyer || p.role === PARTICIPANT_ROLE.seller)
      .map((p) => p.role)
  );
  const availableRoles = INVITABLE_PARTICIPANT_ROLES.filter(
    (r) => r === PARTICIPANT_ROLE.viewer || !takenUnique.has(r)
  ) as ParticipantRole[];
  const [newLinkToken, setNewLinkToken] = useState<string | null>(null);
```

Renderize o `AddParticipantForm` passando `availableRoles`, `onCreated={setNewLinkToken}`; e, quando `newLinkToken`, mostre o link copiável (reuse o `CopyButton` + input readonly, igual ao painel de convite existente) com a dica de 7 dias. Mantenha o `InvitePanel` por slot não-vinculado para "Gerar novo link". Se `availableRoles` ficar vazio (buyer+seller ocupados e quiser só viewer), o form ainda oferece viewer.

- [ ] **Step 5: Testes web** — atualize/!crie `apps/web/tests/add-participant-form.test.tsx` e `participants-drawer.test.tsx` para o novo fluxo (mockar `useAddParticipantMutation` e `useCreateInviteMutation`; submeter nome+e-mail; assertar que ambos foram chamados e o link aparece). Siga o padrão de mocks já usado nesses arquivos.

- [ ] **Step 6: Rodar + commit**

Run: `bun --filter @quitto/api test tests/participants.test.ts && bun --filter @quitto/web test participants && bun --filter @quitto/web test add-participant && bun --filter @quitto/web typecheck`
Expected: PASS.

```bash
git add apps/api/src/modules/participants.ts apps/web/src/components/add-participant-form.tsx apps/web/src/components/participants-drawer.tsx apps/api/tests apps/web/tests
git commit -m "feat: papéis únicos (buyer/seller) + adicionar já gera convite (B6, B7)"
```

---

## Task 8: Fechar — suite, lint, typecheck, build, merge

- [ ] **Step 1: Suite completa**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde (API + Web).

- [ ] **Step 2: Eden tipa os endpoints alterados**

Run: `bun --filter @quitto/web test eden`
Expected: PASS (o detalhe de contrato agora inclui `participants[].isOwner`).

- [ ] **Step 3: Marcar os bugs como corrigidos + merge**

Edite `BUGS.md`: troque 🔧 por ✅ nos B1–B8.

```bash
git add BUGS.md && git commit -m "docs: marca B1–B8 como corrigidos"
git checkout develop
git merge --no-ff fix/participantes-ui-2026-06-13 -m "Merge correções pós-4b (B1–B8) em develop"
```

---

## Self-Review (cobertura dos bugs)

- **B1 cursor-pointer:** Task 1 ✅
- **B2 datepicker/máscara no drawer de parcela:** Task 2 ✅
- **B3 foco cortado no drawer:** Task 4 ✅
- **B4 Select estilizado:** Task 3 (componente + wizard) + Task 7 (add form) ✅
- **B5 dono com papel real + isOwner:** Task 6 ✅
- **B6 unicidade buyer/seller:** Task 7 (API + UI) ✅
- **B7 adicionar já gera convite:** Task 7 ✅
- **B8 papel do dono só buyer/seller:** Task 5 ✅

> **Ordem importa:** Task 5 define `CONTRACT_OWNER_ROLES` usado pela Task 3 (wizard) e Task 6. Se rodar 1→8 na ordem, ok (Task 3 antes da 5 usa fallback inline conforme nota). Recomenda-se 1,2,4 (UI triviais) → 5 (shared/API) → 3 (wizard) → 6 (dono) → 7 (papéis+convite) → 8 (fechar). Ajuste a ordem ao executar.

> **Decisões marcadas no topo** (B5 migração/isOwner, B6 422, B7 e-mail obrigatório no add, B8 neutral fora do produto) — confirme antes de executar; todas reversíveis.
