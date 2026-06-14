# Fase 7g — Feedback de sucesso (toasts)

**Data:** 2026-06-14
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md`

Fatia de polimento (Fase 7). Web-only, sem mudança de API.

## Problema

Os **erros** já têm toast global (`lib/query.ts` → `mutationCache.onError`/`queryCache.onError`,
exceto 401). Mas **nenhuma ação de escrita confirma sucesso** — todas as mutations têm só
`onSuccess` de invalidação, em silêncio. O usuário executa uma ação e não recebe feedback.

## Decisão

- **Mecanismo central, simétrico ao erro:** adicionar `onSuccess` ao `MutationCache` em
  `lib/query.ts` que lê `mutation.meta.successMessage` e dispara `toast.success(...)`. Cada
  mutation **opta** declarando `meta: { successMessage: FEEDBACK.x }`. Sem `toast` espalhado pelos
  hooks; mensagens centralizadas; tipado via augmentation de `mutationMeta`.
- **Mensagens centralizadas** em `lib/feedback.ts` (`FEEDBACK`), pt-BR — sem literais nos hooks.
- **Toasts sobrevivem à navegação SPA** (o `Toaster` é raiz em `main.tsx`), então criar contrato,
  aceitar convite e excluir/sair (que navegam) ainda mostram o toast.

## Ações cobertas

| Hook / mutation | `successMessage` |
|---|---|
| `useSubmitProofMutation` | Comprovante enviado |
| `useConfirmPaymentMutation` | Pagamento confirmado |
| `useDisputePaymentMutation` | Pagamento contestado |
| `useMarkPaidMutation` | Parcela marcada como paga |
| `useCreateContractMutation` | Contrato criado |
| `useUpdateInstallmentMutation` | Parcela atualizada |
| `useAddParticipantMutation` | Participante adicionado |
| `useRemoveParticipantMutation` | Participante removido |
| `useUpdateParticipantRoleMutation` | Papel atualizado |
| `useCreateInviteMutation` | Convite gerado |
| `useAcceptInviteMutation` | Convite aceito |
| `useDeleteContractMutation` | Contrato excluído |
| `useLeaveContractMutation` | Você saiu do contrato |

**Fora de escopo:** `markRead`/`markAllRead` (passivo, viraria spam) e `useDeleteAccountMutation`
(faz reload completo para `/login` — o toast não seria visto).

## Mudanças

- `lib/feedback.ts` (criar): `export const FEEDBACK = { proofSubmitted: "Comprovante enviado", ... } as const;`
- `lib/query.ts` (mod): augmentation `declare module "@tanstack/react-query" { interface Register { mutationMeta: { successMessage?: string } } }`; handler exportado e testável (ex.: `toastSuccessFromMeta(_d,_v,_c,mutation)`) usado no `MutationCache({ onSuccess, onError })`.
- Hooks de mutation (`use-payment-mutations`, `use-contract-mutations`, `use-participant-mutations`, `use-invite`): cada `useMutation` ganha `meta: { successMessage: FEEDBACK.x }`. Os `onSuccess` de invalidação ficam intactos.

## Testes (Vitest)

- **Handler** (`toastSuccessFromMeta`): com `meta.successMessage` → `toast.success` chamado com a
  mensagem; sem `meta` → não chama. (mock de `sonner`.)
- **Ponta a ponta representativa:** rodar 1–2 hooks (ex.: `useCreateContractMutation`,
  `useConfirmPaymentMutation`) com um QueryClient configurado igual ao da app e o `@/lib/api`
  mockado → após o sucesso, `toast.success` é chamado com a mensagem certa (prova a fiação
  hook → meta → handler).
- **Erro não regrediu:** uma mutation que falha não dispara `toast.success` (e segue toastando
  erro pelo `onError`).
- Demais hooks: cobertos por tipo (meta tipado) + smoke; são declarações idênticas de `meta`.

## Verificação

Smoke no dev: cada ação da tabela mostra o toast de sucesso correspondente; nenhuma some atrás de
navegação; erros continuam toastando; marcar notificação lida não toasta.
