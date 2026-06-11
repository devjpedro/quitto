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
| B1 | 2026-06-11 | Wizard: clicar em "Personalizado" não troca o modo; só muda quando outro campo é alterado; não volta pra "Automático" sem voltar ao step 1. **Raiz:** `mode` vem de `watch` + `setValue` do objeto inteiro → re-render não confiável. | `/contracts/new` → step 2 → clicar Personalizado | 🔴 | `fix/contract-wizard` | aberto |
| B2 | 2026-06-11 | Wizard: reclicar o modo já ativo ("Automático") **zera** os valores do step. **Raiz:** `setMode` sempre faz `setValue` resetando o schedule. | step 2 → clicar Automático estando em Automático | 🔴 | `fix/contract-wizard` | aberto |
| B3 | 2026-06-11 | Wizard: ao "Criar contrato" aparece erro literal **"undefined"** no valor total. **Raiz:** `FieldError name="schedule"` faz `String(err.message)` num objeto de erros aninhados sem `.message`. | step 2 → submeter inválido | 🔴 | `fix/contract-wizard` | aberto |
| B4 | 2026-06-11 | Wizard: 1º vencimento não exibe erro de validação. **Raiz:** `FieldError` não resolve caminhos aninhados (`schedule.firstDueDate`) e não há `FieldError` no campo. | step 2 → deixar vencimento vazio → submeter | 🔴 | `fix/contract-wizard` | aberto |
| B5 | 2026-06-11 | Wizard: "Descrição" deveria ser `textarea` (hoje é input de linha única). | `/contracts/new` → step 1 | 🟡 | `fix/contract-wizard` | aberto |
| B6 | 2026-06-11 | Wizard: "Valor total" — tirar "(centavos)" da label e usar **máscara R$** (usuário digita em reais; converte p/ centavos). | step 2 (auto) | 🟡 | `fix/contract-wizard` | aberto |
| B7 | 2026-06-11 | Wizard: "1º vencimento" deveria ser **date picker** + máscara BR `dd/mm/aaaa` ao digitar (converte p/ ISO). | step 2 | 🟡 | `fix/contract-wizard` | aberto |
| B8 | 2026-06-11 | Botões sem `cursor: pointer`. **Raiz:** Tailwind v4 não injeta `cursor-pointer` no preflight; ajustar o componente `Button`. | hover em qualquer botão | 🟢 | `fix/contract-wizard` (rápido) | aberto |
| B9 | 2026-06-11 | Layout muito vazio/estreito no desktop (lista de contratos e wizard). Wizard sem cartão âncora; coluna estreita demais. | desktop largo, `/contracts` e `/contracts/new` | 🟢 | design pass (pode pareiar com o fix) | aberto |

## Resolvidos

_(nenhum por enquanto)_
