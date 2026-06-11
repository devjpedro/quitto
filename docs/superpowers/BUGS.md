# Quitto — Log de Bugs (triagem)

Registro vivo de bugs encontrados durante o desenvolvimento. Cada bug é triado em um balde:

- 🔴 **Bloqueante** — quebra fluxo principal, integridade de dados ou segurança → corrigir **agora**
  (branch `fix/...`, teste de regressão primeiro).
- 🟡 **Fold-in** — melhoria/ajuste de UX no domínio de uma área → agrupar no mesmo fix da área.
- 🟢 **Backlog** — menor/cosmético/não-bloqueante → resolver em lote na Fase 7 (Polimento) ou de oportunidade.

> Como reportar: o que esperava, o que aconteceu, e como reproduzir (passos/rota).

## Abertos

| # | Data | Descrição | Como reproduzir | Balde | Destino | Status |
|---|------|-----------|-----------------|-------|---------|--------|
| _(nenhum por enquanto)_ | | | | | | |

## Resolvidos

Todos os bugs do wizard de criação de contrato (B1–B9) foram corrigidos na branch `fix/contract-wizard` (mergeada em `develop` em 2026-06-11). Funcionais (B1–B4) com teste de regressão escrito antes do fix.

| # | Data | Descrição | Balde | Correção | Resolvido em |
|---|------|-----------|-------|----------|--------------|
| B1 | 2026-06-11 | Wizard: clicar em "Personalizado" não troca o modo; re-render não confiável (`mode` vinha de `watch` + `setValue` do objeto inteiro). | 🔴 | `mode` agora é `useState` local (fonte de render). | 2026-06-11 |
| B2 | 2026-06-11 | Wizard: reclicar o modo já ativo zerava os valores do step (`setMode` sempre resetava o schedule). | 🔴 | Guarda `if (next === mode) return` em `setMode`. | 2026-06-11 |
| B3 | 2026-06-11 | Wizard: erro literal "undefined" no valor total (`FieldError` fazia `String(err.message)` num objeto de erros aninhados). | 🔴 | `FieldError` só renderiza quando `err.message` é string. | 2026-06-11 |
| B4 | 2026-06-11 | Wizard: 1º vencimento não exibia erro de validação (`FieldError` não resolvia caminhos aninhados; faltava `FieldError` no campo). | 🔴 | `getNestedError` resolve paths aninhados + `FieldError` por campo no schedule. | 2026-06-11 |
| B5 | 2026-06-11 | Wizard: "Descrição" era input de linha única. | 🟡 | Componente `Textarea` (shadcn) no `StepBasic`. | 2026-06-11 |
| B6 | 2026-06-11 | Wizard: "Valor total" com "(centavos)" na label e sem máscara. | 🟡 | `CurrencyField` (máscara R$, armazena centavos); label sem "(centavos)". | 2026-06-11 |
| B7 | 2026-06-11 | Wizard: "1º vencimento" sem date picker nem máscara BR. | 🟡 | `DateField` (máscara `dd/mm/aaaa` + picker nativo, armazena ISO) + `parseBRDateToISO`/`maskBRDate`. | 2026-06-11 |
| B8 | 2026-06-11 | Botões sem `cursor: pointer` (Tailwind v4 não injeta no preflight). | 🟢 | `cursor-pointer` na base do `buttonVariants` (cva). | 2026-06-11 |
| B9 | 2026-06-11 | Layout vazio/estreito no desktop (lista e wizard). | 🟢 | Wizard em `Card` (`max-w-2xl`); lista mais larga (`max-w-5xl`). | 2026-06-11 |
