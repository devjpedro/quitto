# Fase 6c — LGPD: exportar meus dados + excluir conta

**Data:** 2026-06-13
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§46 LGPD; §294 retenção)

Terceira e última fatia da Fase 6 (6a Dashboard ✅ → 6b documentos ✅ → **6c LGPD**).

## Objetivo

Dar ao usuário os dois direitos da LGPD: **portabilidade** (exportar seus dados) e **apagamento**
(excluir a conta, removendo contratos próprios e seus arquivos no R2). Operações agem sempre
sobre o **usuário da sessão** — sem parâmetro, impossível atingir outra conta.

## Decisões

- **Comprovante em contrato de terceiro: manter + anonimizar.** `proof.uploadedBy` passa a ser
  **nullable + `onDelete: set null`** (migração). Ao excluir a conta, o comprovante que o usuário
  subiu no contrato de outra pessoa **permanece** (a contraparte tem interesse legítimo no
  registro da transação); só perde o vínculo com o autor. Alinha com a spec, que delimita o
  apagamento a *"contratos próprios e arquivos no R2"*.
- **Export = JSON dos dados** (portabilidade, padrão de mercado — Takeout/Instagram/GitHub).
  Comprovantes (binários) seguem baixáveis pela tela; ZIP com arquivos do R2 = backlog.
- **Confirmação = frase digitada** ("EXCLUIR"). Re-autenticação = backlog.
- **Ordem da exclusão:** coletar chaves R2 → deletar `user` (cascata do banco) → purgar R2
  (best-effort). DB-first evita linhas órfãs apontando para arquivos sumidos; um objeto R2 órfão
  é vazamento menor (logado).
- **Plano único** (API + UI numa branch).

## Migração

`proof.uploadedBy`: `text` nullable, `references(() => user.id, { onDelete: "set null" })`
(hoje é `notNull` + `cascade`). Gerar migration drizzle-kit + aplicar.

Efeito da cascata ao deletar `user` (resumo):
- `contract.ownerId → cascade`: contratos próprios → (parcelas, auditoria) e, via parcela,
  **comprovantes** → cascade. Notificações (`notification.userId → cascade`), sessões/contas →
  cascade.
- `participant.linkedUserId → set null`, `auditEvent.actorUserId → set null`,
  `proof.uploadedBy → set null` (após a migração) — preservam contratos de terceiros.

## Excluir conta — `DELETE /api/me`

1. `requireAuth` → `user`.
2. **Coleta as chaves R2** dos comprovantes dos contratos **que o usuário possui** (serão
   apagados pela cascata): `proof.objectKey` join `installment` join `contract`
   where `contract.ownerId = user.id`.
3. **Deleta a linha `user`** (`db.delete(user).where(eq(user.id, ...))`) — a cascata do banco
   cuida do resto.
4. **`deleteObjects(keys)`** no R2 (best-effort; erro vira log). Comprovantes mantidos (de
   terceiros) não entram na lista.
5. Resposta `{ ok: true }`. O front faz `signOut()` + redirect `/login`.

Endpoint sem params. Erros do AppError seguem o envelope padrão.

## Storage — `deleteObjects(keys: string[])`

Adiciona em `lib/storage.ts` (hoje só presign/head). Usa `DeleteObjectsCommand` (lotes de até
1000); no-op se `keys` vazio. Reusa o helper `s3()`.

## Exportar — `GET /api/me/export`

Builder `buildUserExport(...)` (puro-ish: recebe os dados já carregados, monta o objeto):

```
{
  exportedAt: string;            // ISO (carimbado no handler)
  profile: { id, name, email };
  ownedContracts: [{ contract, installments, participants, auditEvents, proofs (metadados) }];
  participatingContracts: [{ contract, mySlot, installments }];  // contratos de terceiros onde participo
  notifications: [{ type, contractId, installmentId, readAt, createdAt }];
}
```

Resposta JSON com `content-disposition: attachment; filename="quitto-meus-dados.json"`,
`content-type: application/json`. Não inclui dados de terceiros além do necessário ao contexto
dos meus contratos.

## UI — rota `/settings` ("Conta")

Item "Conta" na sidebar + bottom-nav (ícone engrenagem). Página com duas seções:
- **Exportar meus dados:** botão âncora → `/api/me/export` (download direto, cookie same-origin).
- **Zona de perigo — Excluir conta:** card de alerta; botão "Excluir conta" abre `Dialog`
  (controlado por estado — sem `DialogTrigger`) com input que exige digitar **EXCLUIR**
  (constante `DELETE_CONFIRM_PHRASE`) para habilitar o botão destrutivo. Ao confirmar:
  `useDeleteAccountMutation` → `DELETE /api/me` → `signOut()` → `window.location` `/login`.

`hooks/use-account.ts`: `useDeleteAccountMutation`. Export é âncora (sem hook). Frase de
confirmação em `@quitto/shared` (sem literal solto). Identidade B2 via `frontend-design`; a zona
de perigo usa o tom de destaque destrutivo do sistema.

## Testes

- **storage `deleteObjects`** (integração MinIO, `skipIf(!S3_ENDPOINT)`): upload → delete → head
  dá 404; lista vazia é no-op.
- **`DELETE /api/me`** (integração): cria contrato próprio (+ participante terceiro vinculado em
  outro contrato), exclui → contrato próprio e notificações somem; contrato do terceiro
  sobrevive com o slot do usuário `linkedUserId = null`; `deleteObjects` chamado com as chaves
  dos comprovantes próprios (spy/mock ou verificação no MinIO); auth exigida (401).
- **`GET /api/me/export`**: JSON com perfil + contratos próprios + participações; não vaza
  contratos alheios onde não participo; auth exigida.
- **`buildUserExport`** (unit puro): monta as seções a partir de entradas conhecidas.
- **Web:** página renderiza as duas seções; botão de exclusão fica **desabilitado** até digitar
  "EXCLUIR"; ao confirmar chama a mutation; âncora de export com `href` correto.

## Fora de escopo (backlog)

ZIP com arquivos do R2; re-autenticação antes de excluir; período de carência/soft-delete antes
do expurgo (§294); exclusão de contas via admin.
