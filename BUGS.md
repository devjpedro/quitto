# BUGS

Registro de bugs/melhorias encontrados em uso. Cada item tem sintoma + causa raiz
(investigada no código) + tipo. O plano de correção fica em
`docs/superpowers/plans/2026-06-13-fixes-participantes-ui.md`.

> Convenção: ✅ corrigido · 🔧 com plano · 🐛 aberto.

---

## 2026-06-13 — Lote pós-Fase 4b

### B1 — Card de parcela sem `cursor-pointer` 🔧
**Sintoma:** o card de parcela é clicável (abre o drawer), mas o cursor não vira "pointer".
**Causa:** em `apps/web/src/routes/contract-detail.tsx` o card é um `<button>` cru com classes
próprias e sem `cursor-pointer` (o `Button` do design system tem; este botão não usa o componente).
**Tipo:** CSS trivial.

### B2 — Input de vencimento sem datepicker/máscara no drawer de parcela 🔧
**Sintoma:** no drawer de gerenciar parcela, o campo "Vencimento" é um input texto puro
(placeholder `AAAA-MM-DD`), sem máscara nem calendário.
**Causa:** `InstallmentEditForm` (`apps/web/src/components/installment-drawer.tsx`) usa `<Input>` cru
com `register("dueDate")`. Já existe `apps/web/src/components/date-field.tsx` (`DateField`: máscara
dd/mm/aaaa + `<input type="date">`, guarda ISO) usado no wizard — basta reutilizar.
**Tipo:** reuso de componente.

### B3 — Inputs do drawer de participantes com foco "cortado" nas laterais 🔧
**Sintoma:** ao focar um input dentro do drawer de participantes, o anel de foco (ring) é cortado
nas laterais.
**Causa:** o container rolável (`overflow-y-auto`) do `ParticipantsDrawer` corta o `ring-2` dos
inputs colados às bordas; falta folga horizontal.
**Tipo:** CSS (layout/overflow).

### B4 — Select com opções no estilo padrão do navegador 🔧
**Sintoma:** os selects (papel do participante; "Meu papel" no wizard) usam `<select>` nativo — as
**opções** ficam com aparência do SO, destoando do design.
**Causa:** não existe um componente `Select` do design system; `AddParticipantForm` e
`contract-new.tsx` usam `<select>` nativo. `radix-ui` já é dependência.
**Tipo:** novo componente de UI (Radix Select estilo shadcn) + adoção nos 2 lugares.

### B5 — Dono aparece como "dono" em vez de comprador/vendedor 🔧
**Sintoma:** na lista de participantes do contrato, o próprio dono aparece com papel "dono".
**Causa:** no create (`apps/api/src/modules/contracts.ts`) o dono é inserido como `participant` com
`role: "owner"` literal. O papel real dele (comprador/vendedor) está em `contract.ownerRole`.
RBAC deriva o dono de `contract.ownerId` (não do papel), então dá pra guardar o papel real.
**Tipo:** modelo de domínio (API + UI). Relacionado a B6/B8.

### B6 — Papéis comprador/vendedor podem se repetir 🔧
**Sintoma:** dá pra adicionar mais de um comprador ou mais de um vendedor. Só "convidado"
(viewer) deveria repetir.
**Causa:** o handler de adicionar participante (`participants.ts`) não valida unicidade de
papel; a UI sempre oferece os três papéis.
**Tipo:** regra de domínio (API valida unicidade de buyer/seller; UI oculta papel já ocupado).

### B7 — Adicionar comprador/vendedor exige um 2º clique em "Convidar" 🔧
**Sintoma:** ao adicionar um participante, é preciso clicar "Convidar" depois para gerar o link.
**Causa:** o fluxo da 4b separou "adicionar" de "convidar". O ideal é, ao adicionar, já coletar o
e-mail e gerar o link de convite no mesmo passo.
**Tipo:** UX (fundir adicionar + convidar).

### B8 — Criação de contrato oferece papel "neutro" 🔧
**Sintoma:** no wizard, "Meu papel" oferece comprador, vendedor **e neutro** — deveria ser só
comprador ou vendedor.
**Causa:** o select do wizard (`contract-new.tsx`) e o `ownerRoleSchema` (`@quitto/shared`) usam
`OWNER_ROLES` (que inclui `neutral`). O pgEnum mantém `neutral` (sem migração); restringir no
schema + UI.
**Tipo:** regra de domínio (restringir papel do dono a buyer/seller).
