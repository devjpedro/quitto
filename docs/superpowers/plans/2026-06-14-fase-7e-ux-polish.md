# Fase 7e — UX polish (placeholders + responsivo mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar placeholders pessoais por exemplos genéricos centralizados e corrigir os pontos de layout que quebram em telas estreitas (~320px).

**Architecture:** Web-only, sem mudança de API e sem tela nova. Os exemplos de formulário viram um objeto `PLACEHOLDER` central em `lib/labels.ts`. As correções de responsivo são mudanças de classes Tailwind mobile-first (`base` = mobile, `sm:`+ = telas maiores), sem alterar lógica.

**Tech Stack:** React 19 + Vite, TanStack Router/Query v5, Tailwind, shadcn-style `ui/`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-14-fase-7e-ux-polish-design.md`

**Git:** branch `feat/fase-7e-ux-polish` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 7e no ROADMAP.

**Convenções:** código em inglês; sem literais espalhados; sem comentários óbvios. Mobile-first. Os testes existentes não podem regredir.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/lib/labels.ts` (mod) | adiciona `PLACEHOLDER` (copy central) |
| `apps/web/src/routes/contract-new.tsx` (mod) | placeholder do título + parcelas custom responsivas + padding |
| `apps/web/src/components/add-participant-form.tsx` (mod) | placeholder do nome |
| `apps/web/src/components/payment-actions.tsx` (mod) | placeholder do motivo da contestação |
| `apps/web/src/routes/contract-detail.tsx` (mod) | linha de parcela sem quebra + participantes com wrap + padding |
| `apps/web/src/routes/notifications.tsx` (mod) | header empilha no mobile + padding |
| `apps/web/src/components/ui/sheet.tsx` (mod) | padding do Sheet responsivo |
| `apps/web/src/components/participants-drawer.tsx` (mod) | item de participante com wrap |
| `apps/web/tests/add-participant-form.test.tsx` (mod) | asserção de placeholder |
| `apps/web/tests/contract-new.test.tsx` (mod) | asserção de placeholder |
| `apps/web/tests/payment-actions.test.tsx` (mod) | asserção de placeholder |

---

## Task 1: Placeholders genéricos e centralizados

**Files:**
- Modify: `apps/web/src/lib/labels.ts`
- Modify: `apps/web/src/routes/contract-new.tsx:77`
- Modify: `apps/web/src/components/add-participant-form.tsx:88`
- Modify: `apps/web/src/components/payment-actions.tsx:142`
- Test: `apps/web/tests/add-participant-form.test.tsx`, `apps/web/tests/contract-new.test.tsx`, `apps/web/tests/payment-actions.test.tsx`

- [ ] **Step 1: Adicionar a copy central**

No fim de `apps/web/src/lib/labels.ts`, adicione:

```ts
/** Exemplos genéricos de placeholder de formulário (sem nomes/relações pessoais). */
export const PLACEHOLDER = {
  contractTitle: "Ex.: Aluguel do apartamento",
  participantName: "Ex.: Maria",
  disputeReason: "Ex.: valor diferente do combinado",
} as const;
```

- [ ] **Step 2: Testes que falham**

Em `apps/web/tests/add-participant-form.test.tsx`, adicione o import no topo (junto aos outros imports):

```tsx
import { PLACEHOLDER } from "../src/lib/labels";
```

e adicione este caso dentro do `describe("AddParticipantForm", ...)`:

```tsx
it("usa um placeholder de nome genérico", () => {
  renderWithProviders(<AddParticipantForm {...DEFAULT_PROPS} onDone={vi.fn()} />);
  expect(screen.getByLabelText(NAME_LABEL)).toHaveAttribute(
    "placeholder",
    PLACEHOLDER.participantName
  );
});
```

Em `apps/web/tests/contract-new.test.tsx`, adicione o import:

```tsx
import { PLACEHOLDER } from "../src/lib/labels";
```

e adicione dentro do `describe("ContractNewPage (wizard)", ...)`:

```tsx
it("usa um placeholder de título genérico", () => {
  renderWithProviders(<ContractNewPage />);
  expect(screen.getByLabelText(TITLE)).toHaveAttribute(
    "placeholder",
    PLACEHOLDER.contractTitle
  );
});
```

Em `apps/web/tests/payment-actions.test.tsx`, adicione o import:

```tsx
import { PLACEHOLDER } from "../src/lib/labels";
```

e adicione dentro do `describe("PaymentActions", ...)`:

```tsx
it("usa um placeholder de motivo genérico na contestação", async () => {
  renderWithProviders(
    <PaymentActions
      {...base}
      capabilities={{ isPayer: false, isApprover: true }}
      requiresConfirmation
      status="awaiting_confirmation"
    />
  );
  await userEvent.click(screen.getByRole("button", { name: DISPUTE_TRIGGER }));
  expect(screen.getByLabelText(REASON_LABEL)).toHaveAttribute(
    "placeholder",
    PLACEHOLDER.disputeReason
  );
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/add-participant-form.test.tsx tests/contract-new.test.tsx tests/payment-actions.test.tsx`
Expected: FAIL (placeholders ainda são os textos pessoais antigos).

- [ ] **Step 4: Trocar os placeholders pelas constantes**

Em `apps/web/src/routes/contract-new.tsx`: adicione `PLACEHOLDER` ao import existente de `@/lib/labels` (hoje `import { ROLE_LABEL } from "@/lib/labels";` → `import { PLACEHOLDER, ROLE_LABEL } from "@/lib/labels";`) e troque a linha 77:

```tsx
          placeholder={PLACEHOLDER.contractTitle}
```

Em `apps/web/src/components/add-participant-form.tsx`: troque o import `import { ROLE_LABEL } from "@/lib/labels";` por `import { PLACEHOLDER, ROLE_LABEL } from "@/lib/labels";` e a linha 88:

```tsx
          placeholder={PLACEHOLDER.participantName}
```

Em `apps/web/src/components/payment-actions.tsx`: importe `PLACEHOLDER` de `@/lib/labels` (se já houver import de `@/lib/labels`, acrescente; senão adicione `import { PLACEHOLDER } from "@/lib/labels";`) e troque a linha 142:

```tsx
              placeholder={PLACEHOLDER.disputeReason}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/add-participant-form.test.tsx tests/contract-new.test.tsx tests/payment-actions.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/labels.ts apps/web/src/routes/contract-new.tsx apps/web/src/components/add-participant-form.tsx apps/web/src/components/payment-actions.tsx apps/web/tests/add-participant-form.test.tsx apps/web/tests/contract-new.test.tsx apps/web/tests/payment-actions.test.tsx
git commit -m "feat(web): placeholders genéricos centralizados (PLACEHOLDER)"
```

---

## Task 2: Detalhe do contrato — linha de parcela e participantes no mobile

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx`

Sem teste novo: são mudanças de classe; a verificação é a suíte existente (sem regressão) + checagem visual a 320px. Os textos/labels não mudam.

- [ ] **Step 1: Padding de página mobile-first**

Em `apps/web/src/routes/contract-detail.tsx`, troque as DUAS ocorrências de `mx-auto max-w-3xl p-6` (o estado de loading na linha ~74 e o container principal na linha ~96) por `mx-auto max-w-3xl p-4 sm:p-6`.

- [ ] **Step 2: Linha de parcela — valor não quebra**

Ainda em `contract-detail.tsx`, na lista de parcelas (~203-209), ajuste as classes da data e do valor para a data ceder espaço e o valor nunca quebrar:

```tsx
                  <span className="min-w-0 flex-1 truncate text-foreground text-sm tabular-nums">
                    {formatISODateBR(it.dueDate)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display font-semibold text-foreground text-sm tabular-nums">
                    {formatBRL(it.amountCents)}
                  </span>
```

(O `<StatusBadge>` na sequência já é `shrink-0` por ser um badge; não precisa mudar.)

- [ ] **Step 3: Seção Participantes — badges fazem wrap**

Ainda em `contract-detail.tsx`, na seção PARTICIPANTES (~160), troque a classe do `<li>` de `flex items-center gap-3 text-sm` para permitir quebra dos badges abaixo do nome:

```tsx
            <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" key={p.id}>
```

e dê `min-w-0` ao nome (~165):

```tsx
              <span className="min-w-0 font-medium text-foreground">
                {p.displayName}
              </span>
```

- [ ] **Step 4: Sem regressão**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-detail.test.tsx tests/contract-detail-deeplink.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/contract-detail.tsx
git commit -m "fix(web): detalhe do contrato responsivo no mobile (valor sem quebra, participantes com wrap, padding)"
```

---

## Task 3: Wizard — parcelas personalizadas empilham no mobile

**Files:**
- Modify: `apps/web/src/routes/contract-new.tsx`

Sem teste novo (layout). A suíte existente do wizard cobre o comportamento (adicionar/remover parcela) e não pode regredir.

- [ ] **Step 1: Padding de página mobile-first**

Em `apps/web/src/routes/contract-new.tsx`, troque o container principal (linha ~312) de `mx-auto max-w-2xl p-6` para `mx-auto max-w-2xl p-4 sm:p-6`.

- [ ] **Step 2: Empilhar Valor/Vencimento no mobile**

Em `CustomSchedule` (~182-209), troque a `<div>` da linha da parcela e a posição do botão remover para empilhar no mobile e ir inline a partir de `sm`:

```tsx
        <div
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-end"
          key={field.id}
        >
          <div className="flex-1">
            <Label>Valor</Label>
            <CurrencyField
              id={`amt-${index}`}
              name={`schedule.installments.${index}.amountCents`}
            />
          </div>
          <div className="flex-1">
            <Label>Vencimento</Label>
            <DateField
              id={`due-${index}`}
              name={`schedule.installments.${index}.dueDate`}
            />
          </div>
          <Button
            aria-label="Remover parcela"
            className="self-end"
            onClick={() => remove(index)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
```

(No mobile os campos ficam em coluna com largura total — o input de data deixa de truncar; em `sm`+ volta a ficar lado a lado como hoje, com o botão alinhado embaixo.)

- [ ] **Step 3: Sem regressão**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-new.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/contract-new.tsx
git commit -m "fix(web): parcelas personalizadas empilham no mobile (input de data deixa de truncar)"
```

---

## Task 4: Header de Notificações empilha no mobile

**Files:**
- Modify: `apps/web/src/routes/notifications.tsx`

- [ ] **Step 1: Padding + header responsivo**

Em `apps/web/src/routes/notifications.tsx`:
- container (linha 31): `mx-auto max-w-2xl p-6` → `mx-auto max-w-2xl p-4 sm:p-6`
- header (linha 32): `mb-6 flex items-center justify-between` → `mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`
- título (linha 33): `font-bold font-display text-2xl tracking-tight` → `font-bold font-display text-xl tracking-tight sm:text-2xl`
- a ação "Marcar todas como lidas" (botão na linha 37): adicione `self-start sm:self-auto` à className para alinhar à esquerda no mobile (mantenha as demais classes).

- [ ] **Step 2: Sem regressão**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/notifications-page.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/notifications.tsx
git commit -m "fix(web): header de notificações empilha no mobile"
```

---

## Task 5: Sheet e item de participante no mobile

**Files:**
- Modify: `apps/web/src/components/ui/sheet.tsx`
- Modify: `apps/web/src/components/participants-drawer.tsx`

- [ ] **Step 1: Padding do Sheet mobile-first**

Em `apps/web/src/components/ui/sheet.tsx` (linha 25), no `cn(...)` do `SheetPrimitive.Content`, troque `p-6` por `p-4 sm:p-6` (mantenha o restante da string idêntico).

- [ ] **Step 2: Item de participante — badges/menu fazem wrap**

Em `apps/web/src/components/participants-drawer.tsx`, no `ParticipantItem` (~171), troque a `<div>` do cabeçalho de `flex items-center gap-2` para permitir wrap e dê `min-w-0` ao nome (~176):

```tsx
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${participant.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
        <span className="min-w-0 font-medium text-foreground text-sm">
          {participant.displayName}
        </span>
```

(O botão `⋯` mantém `ml-auto`, que continua empurrando o menu para a direita; com `flex-wrap` os badges descem quando faltar espaço em vez de espremer o nome.)

- [ ] **Step 3: Sem regressão**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/participants-drawer.test.tsx tests/dialog.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/ui/sheet.tsx apps/web/src/components/participants-drawer.tsx
git commit -m "fix(web): Sheet e item de participante responsivos no mobile"
```

---

## Task 6: Investigar os pontos cinzas soltos

**Files:** (investigação; arquivos só se houver fix)

Contexto: nas imagens do usuário aparecem círculos cinzas fora do card no wizard de novo contrato (acima/abaixo do card) e no Sheet de participantes (topo). Uma varredura estática inicial **não localizou** o elemento (CSS, pseudo-elementos, overlays Radix). É preciso reproduzir antes de tocar em código.

- [ ] **Step 1: Reproduzir no dev a 320px**

Suba o app: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run dev`. No navegador, abra o DevTools em modo responsivo a 320px e visite `/contracts/new` (passos 1 e 2) e abra o Sheet de Participantes num contrato (como dono). Observe se os círculos cinzas aparecem **renderizados na página** ou se são handles/scrollbar do próprio DevTools.

- [ ] **Step 2: Decidir e agir**

- Se os círculos forem um elemento **nosso** (ex.: indicador mal-posicionado, handle, resíduo de componente), corrigir o elemento responsável e commitar:
  ```bash
  cd /home/buckz/Documentos/www/personal-projects/quitto
  git add -A
  git commit -m "fix(web): remove pontos cinzas soltos no wizard/sheet (mobile)"
  ```
- Se forem **artefato do DevTools** (device mode: alças de redimensionamento / scrollbar), **não há fix de código**. Reporte a conclusão (com o que foi observado) — esta tarefa é concluída sem alteração de código.

Esta tarefa NÃO bloqueia o restante: se a reprodução for inconclusiva, reporte como DONE_WITH_CONCERNS descrevendo o que viu, e segue.

---

## Task 7: Verificação final + merge + roadmap

- [ ] **Step 1: Suíte do web**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: verde.

- [ ] **Step 2: Typecheck + lint**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes.

- [ ] **Step 3: Smoke visual a 320px**

Com `bun run dev`, revise a 320px: detalhe do contrato (valor da parcela em uma linha, badges de participante reflowando), wizard custom (input de data inteiro, campos empilhados), notificações (título e ação empilhados), Sheet de participantes (padding confortável, nome não espremido). Sem overflow horizontal.

- [ ] **Step 4: Marcar a 7e no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, marque a linha **7e** como concluída:
`` | **7e** | UX polish (mobile) | Placeholders genéricos centralizados (`PLACEHOLDER`); responsivo a 320px (valor da parcela sem quebra, parcelas custom empilhadas, header de notificações, item de participante com wrap, padding mobile-first). | `plans/2026-06-14-fase-7e-ux-polish.md` ✅ **concluído** (merge em `develop`; suite verde) | ``
(Se a linha 7e ainda não existir como tal, adicione-a junto às sub-fases 7b/7c/7d.)

- [ ] **Step 5: Commit do roadmap + merge**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 7e concluída"
git checkout develop
git merge --no-ff feat/fase-7e-ux-polish -m "Merge: Fase 7e — UX polish (mobile)"
```

Expected: merge limpo; suite do web verde em `develop`.

---

## Notas para o executor

- **Mobile-first:** classes sem prefixo valem para o mobile; `sm:` ajusta para telas ≥640px. Nunca remova um comportamento desktop existente — só adicione o do mobile.
- **Sem mudança de copy além dos 3 placeholders.** Os placeholders já genéricos (`pessoa@exemplo.com`, `Detalhes do acordo`) ficam como estão (YAGNI).
- **Responsivo não tem teste unitário significativo** — a garantia é a suíte existente passar (as mudanças são de classe) + a checagem visual no dev.
- **Pontos cinzas (Task 6):** não inventar fix. Reproduzir → se nosso, corrigir; se DevTools, documentar.
