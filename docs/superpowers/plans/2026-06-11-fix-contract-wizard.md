# Fix — Wizard de Criação de Contrato (B1–B9) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Bugs: **reproduzir com teste primeiro** (superpowers:systematic-debugging) nos funcionais. Steps usam checkbox (`- [ ]`).

**Goal:** Corrigir os bugs do wizard de criação de contrato (`apps/web/src/routes/contract-new.tsx`): toggle de modo quebrado e reset de valores, erro "undefined" e validação aninhada não exibida, descrição em textarea, máscara R$ no valor, date picker BR no vencimento, cursor nos botões, e um refino de layout.

**Architecture:** Os funcionais (B1–B4) têm causa-raiz em RHF (modo derivado de `watch`+`setValue` e `FieldError` sem resolução de path aninhado) — corrigidos com `mode` em `useState` e um `FieldError` que resolve paths. Máscaras (B6/B7) viram componentes controlados (`Controller`) reutilizando os helpers de `lib/format`. Cursor (B8) no `Button` (cva). Layout (B9) via skill de design, na identidade B2.

**Tech Stack:** React 19, React Hook Form, Zod (`@quitto/shared`), shadcn/ui, Tailwind v4, Vitest + Testing Library.

> **Convenção (spec §9):** código/comentários em inglês; UI em pt-BR.
> **Pré-requisitos:** Fases 0–2 em `develop`. Branch `fix/contract-wizard` a partir de `develop`. Ao fim, merge em `develop` e marcar B1–B9 como resolvidos no `BUGS.md`.

> **Referência de arquivos atuais:** `routes/contract-new.tsx` (wizard), `lib/format.ts` (`formatBRL`, `parseBRLToCents`, `formatISODateBR`), `components/ui/button.tsx` (cva), `tests/contract-new.test.tsx`, `tests/test-utils.tsx` (render com providers).

---

## Task 1: B8 — `cursor-pointer` nos botões (rápido)

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`

- [ ] **Step 1: Adicionar `cursor-pointer` à base do cva**

Na string base do `buttonVariants` (primeiro argumento do `cva`), acrescente `cursor-pointer` logo após `inline-flex` (o `disabled:pointer-events-none` já existente impede o cursor em botões desabilitados):

```
"inline-flex cursor-pointer shrink-0 items-center justify-center gap-2 whitespace-nowrap ...
```

- [ ] **Step 2: Typecheck + verificar**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS. (Visual: ao subir o app, qualquer botão mostra a mãozinha; desabilitado não.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/button.tsx
git commit -m "fix(web): cursor-pointer nos botões (Tailwind v4) [B8]"
```

---

## Task 2: B3 + B4 — `FieldError` resolve paths aninhados (TDD)

> **Reproduzir primeiro:** hoje `FieldError name="schedule"` mostra "undefined" e o vencimento não exibe erro. A causa é `(errors as any)[name]` não navegar `schedule.firstDueDate` e não checar se `message` é string.

**Files:**
- Modify: `apps/web/src/routes/contract-new.tsx`
- Test: `apps/web/tests/contract-new.test.tsx`

- [ ] **Step 1: Escrever o teste de regressão (falha hoje)**

Adicione em `apps/web/tests/contract-new.test.tsx` (use os imports/render já existentes no arquivo; este teste assume `render` de `./test-utils` e `userEvent`):

```tsx
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { render } from "./test-utils";
import { ContractNewPage } from "../src/routes/contract-new";

async function gotoStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Título"), "Apê");
  await user.click(screen.getByRole("button", { name: "Avançar" }));
}

it("[B3/B4] mostra erros de validação aninhados e nunca a string 'undefined'", async () => {
  const user = userEvent.setup();
  render(<ContractNewPage />);
  await gotoStep2(user);
  await user.click(screen.getByRole("button", { name: "Criar contrato" }));
  await waitFor(() => {
    expect(screen.getByText("Data inválida (use AAAA-MM-DD)")).toBeInTheDocument();
  });
  expect(screen.queryByText("undefined")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test contract-new`
Expected: FAIL — "undefined" presente / mensagem do vencimento ausente.

- [ ] **Step 3: Corrigir o `FieldError` e adicionar erros por campo**

Em `contract-new.tsx`, substitua a função `FieldError` por uma que resolve path aninhado e só renderiza string:

```tsx
function getNestedError(errors: unknown, path: string): { message?: unknown } | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, errors) as { message?: unknown } | undefined;
}

function FieldError({ name }: { name: string }) {
  const { formState } = useFormContext<CreateContractInput>();
  const err = getNestedError(formState.errors, name);
  if (typeof err?.message !== "string") {
    return null;
  }
  return (
    <p className="mt-1.5 font-medium text-destructive text-xs">{err.message}</p>
  );
}
```

Em `AutoSchedule`, troque o `<FieldError name="schedule" />` (que ficava no total) e adicione um por campo:

```tsx
        {/* abaixo do Input de total */}
        <FieldError name="schedule.totalAmountCents" />
```
```tsx
        {/* abaixo do Input de nº de parcelas */}
        <FieldError name="schedule.installmentsCount" />
```
```tsx
        {/* abaixo do Input de 1º vencimento */}
        <FieldError name="schedule.firstDueDate" />
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test contract-new`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/contract-new.tsx apps/web/tests/contract-new.test.tsx
git commit -m "fix(web): FieldError resolve paths aninhados; erros por campo no schedule [B3,B4]"
```

---

## Task 3: B1 + B2 — Modo do cronograma via `useState` (sem reset indevido) (TDD)

> **Reproduzir primeiro:** clicar "Personalizado" não troca; reclicar "Automático" zera os valores. Causa: `mode` derivado de `watch` + `setMode` sempre faz `setValue` do objeto inteiro.

**Files:**
- Modify: `apps/web/src/routes/contract-new.tsx`
- Test: `apps/web/tests/contract-new.test.tsx`

- [ ] **Step 1: Escrever o teste de regressão**

```tsx
it("[B1/B2] alterna auto/personalizado e não zera ao reclicar o modo ativo", async () => {
  const user = userEvent.setup();
  render(<ContractNewPage />);
  await user.type(screen.getByLabelText("Título"), "Apê");
  await user.click(screen.getByRole("button", { name: "Avançar" }));

  // troca para Personalizado -> aparece "Adicionar parcela"
  await user.click(screen.getByRole("button", { name: "Personalizado" }));
  expect(screen.getByRole("button", { name: /Adicionar parcela/ })).toBeInTheDocument();

  // volta para Automático -> aparece "Nº de parcelas"
  await user.click(screen.getByRole("button", { name: "Automático" }));
  const count = screen.getByLabelText("Nº de parcelas") as HTMLInputElement;
  await user.clear(count);
  await user.type(count, "12");
  // reclicar Automático (já ativo) NÃO pode zerar
  await user.click(screen.getByRole("button", { name: "Automático" }));
  expect((screen.getByLabelText("Nº de parcelas") as HTMLInputElement).value).toBe("12");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test contract-new`
Expected: FAIL.

- [ ] **Step 3: Corrigir `ContractNewPage`**

Substitua o trecho do `mode`/`setMode` por estado local como fonte de renderização, com guarda:

```tsx
  const [mode, setModeState] = useState<ScheduleMode>("auto");

  function setMode(next: ScheduleMode) {
    if (next === mode) {
      return; // [B2] reclicar o modo ativo não reseta
    }
    setModeState(next);
    form.setValue(
      "schedule",
      next === "auto"
        ? { mode: "auto", totalAmountCents: 0, installmentsCount: 1, firstDueDate: "" }
        : { mode: "custom", installments: [{ amountCents: 0, dueDate: "" }] },
      { shouldValidate: false },
    );
  }
```

Remova a linha `const mode = form.watch("schedule.mode");` (agora `mode` é o `useState`). O restante do JSX (`active={mode === "auto"}`, `{mode === "auto" ? <AutoSchedule/> : <CustomSchedule/>}`) continua igual, mas agora lê o estado local — re-render confiável [B1].

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test contract-new`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/contract-new.tsx apps/web/tests/contract-new.test.tsx
git commit -m "fix(web): modo do cronograma via useState + guarda anti-reset [B1,B2]"
```

---

## Task 4: B5 — Descrição como `textarea`

**Files:**
- Create: `apps/web/src/components/ui/textarea.tsx`
- Modify: `apps/web/src/routes/contract-new.tsx`

- [ ] **Step 1: Adicionar o componente shadcn textarea**

Run: `cd apps/web && bunx shadcn@latest add textarea`
Expected: cria `src/components/ui/textarea.tsx`.

- [ ] **Step 2: Usar no `StepBasic`**

Em `contract-new.tsx`, importe e troque o `<Input id="description">` por `<Textarea>`:

```tsx
import { Textarea } from "@/components/ui/textarea";
```
```tsx
        <Textarea
          className="mt-1.5"
          id="description"
          placeholder="Detalhes do acordo"
          rows={3}
          {...register("description")}
        />
```

- [ ] **Step 3: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck`

```bash
git add apps/web/src/components/ui/textarea.tsx apps/web/src/routes/contract-new.tsx apps/web/package.json bun.lock
git commit -m "fix(web): descrição do contrato em textarea [B5]"
```

---

## Task 5: B6 — Máscara R$ no valor (centavos por baixo)

**Files:**
- Create: `apps/web/src/components/currency-field.tsx`
- Modify: `apps/web/src/routes/contract-new.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/currency-field.tsx`**

```tsx
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";

/** Currency input: shows R$ formatted, stores integer cents. Digits accumulate from the right. */
export function CurrencyField({ name, id }: { name: string; id: string }) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name as never}
      render={({ field }) => {
        const cents = typeof field.value === "number" ? field.value : 0;
        return (
          <Input
            className="mt-1.5 tabular-nums"
            id={id}
            inputMode="numeric"
            onBlur={field.onBlur}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              field.onChange(digits === "" ? 0 : Number.parseInt(digits, 10));
            }}
            placeholder="R$ 0,00"
            value={cents > 0 ? formatBRL(cents) : ""}
          />
        );
      }}
    />
  );
}
```

- [ ] **Step 2: Usar no `AutoSchedule` e no `CustomSchedule`**

Em `AutoSchedule`, troque o bloco do total: a Label vira `Valor total` (sem "(centavos)") e o Input por `CurrencyField`:

```tsx
        <Label htmlFor="total">Valor total</Label>
        <CurrencyField id="total" name="schedule.totalAmountCents" />
        <FieldError name="schedule.totalAmountCents" />
```

Em `CustomSchedule`, troque o Input de valor por `CurrencyField` (mantendo o `name` indexado):

```tsx
            <Label>Valor</Label>
            <CurrencyField id={`amt-${index}`} name={`schedule.installments.${index}.amountCents`} />
```

Importe no topo: `import { CurrencyField } from "@/components/currency-field";`

- [ ] **Step 3: Teste rápido do parse (helper já existe)**

Garanta que `tests/format.test.ts` cobre `parseBRLToCents` (já deve cobrir; se não, adicione `expect(parseBRLToCents("R$ 1.234,56")).toBe(123456)`). Run: `bun --filter @quitto/web test format`
Expected: PASS.

- [ ] **Step 4: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test contract-new`

```bash
git add apps/web/src/components/currency-field.tsx apps/web/src/routes/contract-new.tsx
git commit -m "fix(web): máscara R$ no valor (armazena centavos) [B6]"
```

---

## Task 6: B7 — Vencimento com máscara BR + picker

**Files:**
- Modify: `apps/web/src/lib/format.ts` (+ `parseBRDateToISO`)
- Create: `apps/web/src/components/date-field.tsx`
- Modify: `apps/web/src/routes/contract-new.tsx`
- Test: `apps/web/tests/format.test.ts`

- [ ] **Step 1: Adicionar `parseBRDateToISO` em `lib/format.ts` (TDD)**

Teste em `tests/format.test.ts`:

```ts
import { parseBRDateToISO } from "../src/lib/format";

it("parseBRDateToISO converte dd/mm/aaaa válida em ISO", () => {
  expect(parseBRDateToISO("31/12/2026")).toBe("2026-12-31");
});
it("parseBRDateToISO rejeita data impossível", () => {
  expect(parseBRDateToISO("31/02/2026")).toBeNull();
});
it("parseBRDateToISO rejeita formato incompleto", () => {
  expect(parseBRDateToISO("1/2/26")).toBeNull();
});
```

Implementação (adicione ao fim de `lib/format.ts`):

```ts
/** Parses a BR date (dd/mm/yyyy) into ISO (yyyy-mm-dd), or null if invalid/impossible. */
export function parseBRDateToISO(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) {
    return null;
  }
  const [, d, mo, y] = m;
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  if (dt.getUTCDate() !== Number(d) || dt.getUTCMonth() + 1 !== Number(mo)) {
    return null; // rejeita 31/02 etc.
  }
  return `${y}-${mo}-${d}`;
}

/** Inserts the BR date mask (dd/mm/yyyy) into raw typed digits. */
export function maskBRDate(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}
```

Run: `bun --filter @quitto/web test format`
Expected: PASS.

- [ ] **Step 2: Criar `apps/web/src/components/date-field.tsx`**

```tsx
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatISODateBR, maskBRDate, parseBRDateToISO } from "@/lib/format";

function DateInput({
  id,
  value,
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  onBlur: () => void;
}) {
  const [text, setText] = useState(value ? formatISODateBR(value) : "");
  return (
    <div className="relative mt-1.5">
      <Input
        className="tabular-nums"
        id={id}
        inputMode="numeric"
        onBlur={onBlur}
        onChange={(e) => {
          const masked = maskBRDate(e.target.value);
          setText(masked);
          onChange(parseBRDateToISO(masked) ?? "");
        }}
        placeholder="dd/mm/aaaa"
        value={text}
      />
      {/* picker nativo como afford ância de calendário */}
      <input
        aria-label="Escolher data no calendário"
        className="absolute inset-y-0 right-2 my-auto h-5 w-5 cursor-pointer opacity-70"
        onChange={(e) => {
          const iso = e.target.value;
          onChange(iso);
          setText(iso ? formatISODateBR(iso) : "");
        }}
        type="date"
        value={value ?? ""}
      />
    </div>
  );
}

/** RHF-bound date field: types as dd/mm/yyyy (masked) or picks via native calendar; stores ISO. */
export function DateField({ name, id }: { name: string; id: string }) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name as never}
      render={({ field }) => (
        <DateInput
          id={id}
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={typeof field.value === "string" ? field.value : ""}
        />
      )}
    />
  );
}
```

- [ ] **Step 3: Usar no `AutoSchedule` e `CustomSchedule`**

Em `AutoSchedule`, troque o Input do 1º vencimento:

```tsx
        <Label htmlFor="first">1º vencimento</Label>
        <DateField id="first" name="schedule.firstDueDate" />
        <FieldError name="schedule.firstDueDate" />
```

Em `CustomSchedule`, troque o Input de vencimento:

```tsx
            <Label>Vencimento</Label>
            <DateField id={`due-${index}`} name={`schedule.installments.${index}.dueDate`} />
```

Importe: `import { DateField } from "@/components/date-field";`

- [ ] **Step 4: Typecheck + testes**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test contract-new`
Expected: PASS (inclusive o teste B3/B4 — o vencimento agora valida e converte).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/components/date-field.tsx apps/web/src/routes/contract-new.tsx apps/web/tests/format.test.ts
git commit -m "fix(web): vencimento com máscara BR + picker (armazena ISO) [B7]"
```

---

## Task 7: B9 — Refino de layout (wizard em cartão + lista mais larga)

> **Diretriz (spec §5 / memória):** usar a skill de design (frontend-design / ui-ux-pro-max) na identidade **B2 (teal + areia)**. **Não** UI genérica. Mudanças concretas abaixo; ajuste fino com a skill.

**Files:**
- Modify: `apps/web/src/routes/contract-new.tsx`
- Modify: `apps/web/src/routes/contracts-list.tsx`

- [ ] **Step 1: Invocar a skill de design** para o refino visual destas duas telas, mantendo os tokens B2.

- [ ] **Step 2: Wizard em cartão**

Em `contract-new.tsx`, envolver o `<Stepper>` + `<form>` num `Card` com padding, e alargar a coluna (`max-w-2xl`):

```tsx
import { Card } from "@/components/ui/card";
```
```tsx
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">{/* título + subtítulo (inalterado) */}</div>
      <Card className="p-6 sm:p-8">
        <div className="mb-8">
          <Stepper current={step} onStepClick={setStep} steps={STEPS} />
        </div>
        <FormProvider {...form}>
          {/* form inalterado */}
        </FormProvider>
      </Card>
    </div>
```

- [ ] **Step 3: Lista mais larga e densa**

Em `contracts-list.tsx`, alargar a área de conteúdo (ex.: container `max-w-5xl` em vez do estreito atual) e revisar a densidade das linhas de contrato com a skill (mais respiro horizontal, hierarquia título/valores). Manter responsivo.

- [ ] **Step 4: Verificar visualmente + typecheck + testes**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test`
Expected: PASS. (Suba o app e confira lista + wizard preenchendo melhor o desktop.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/contract-new.tsx apps/web/src/routes/contracts-list.tsx
git commit -m "fix(web): refino de layout — wizard em cartão + lista mais larga [B9]"
```

---

## Task 8: Fechar — suite, merge e BUGS.md

- [ ] **Step 1: Suite completa**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 2: Merge em `develop`**

```bash
git checkout develop
git merge --no-ff fix/contract-wizard -m "Merge fix/contract-wizard (B1-B9) em develop"
```

- [ ] **Step 3: Marcar B1–B9 como resolvidos no `BUGS.md`** (mover para a seção "Resolvidos" com a data) e commit:

```bash
git add docs/superpowers/BUGS.md
git commit -m "docs(bugs): B1-B9 do wizard resolvidos"
```

---

## Self-Review (cobertura)

- **B1 toggle não troca:** Task 3 (mode via useState) ✅
- **B2 reclicar zera valores:** Task 3 (guarda `if next===mode`) ✅
- **B3 erro "undefined":** Task 2 (FieldError checa string + path) ✅
- **B4 vencimento sem validação:** Tasks 2 (FieldError por campo) + 6 ✅
- **B5 descrição textarea:** Task 4 ✅
- **B6 máscara R$ / label sem "centavos":** Task 5 ✅
- **B7 date picker + máscara BR:** Task 6 ✅
- **B8 cursor pointer:** Task 1 ✅
- **B9 layout:** Task 7 ✅
- **Regressão protegida:** testes em Tasks 2, 3, 6 (funcionais) ✅

> **Nota:** os funcionais (B1–B4) têm teste de regressão **antes** do fix (systematic-debugging). Se algum seletor do teste não casar com o markup atual, ajuste o seletor — o comportamento testado é o que importa.
