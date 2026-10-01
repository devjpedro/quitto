---
status: accepted
date: 2026-07-14
---

# Identidade do produto: solo-first, outra parte opcional

O Quitto é **solo-first**: uma pessoa sempre mantém o registro (a fonte da verdade) e o app é
**100% útil sozinho**. Convidar a outra parte é um **upgrade opcional** para quando ela topar
participar — nunca um requisito.

## Contexto

Os dois cenários reais do dono do produto: (1) o apê comprado do irmão — co-parte que pode topar
participar; (2) o aluguel com um inquilino que **não vai** criar conta. Em acordo informal no Brasil,
forçar a outra parte a onboardar é atrito que quase nunca é pago. O código **já** suporta isso:
`getCapabilities` faz o dono **herdar** pagador e aprovador quando ninguém está vinculado.

## Decisão

Assumir explicitamente solo-first como a identidade que **filtra o escopo de features**. Não dobrar
em multi-party (o outro lado raramente onboarda) nem virar solo puro (jogaria fora o diferencial de
"prova entre partes" do caso do irmão).

## Consequences (features que isso destrava)

- **Contato sem convite**: nomear a outra parte sem cerimônia de convite (participant com `displayName`
  sem `linkedUserId`), com caminho de upgrade "convidar este contato" depois.
- **Comunicar pra fora**: recibo/extrato entregue a **não-usuários** (e-mail e link `wa.me`), já que o
  outro lado frequentemente não tem conta (ver ADR-0006).
