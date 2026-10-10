---
status: accepted
date: 2026-10-08
---

# i18n com Paraglide (pt-BR e en-US)

O app fala **pt-BR** (base) e **en-US**, com as mensagens em `apps/web/src/messages/*.json`
compiladas pelo **Paraglide JS** (funções tipadas, tree-shaken). A moeda continua **BRL** nos dois
idiomas; datas e números seguem o locale via `Intl`.

## Contexto

O redesign vai a gente de fora do Brasil (convidados, recibo público) e o front é SSR (ADR-0001): o
servidor precisa renderizar no idioma certo **sem flash** e sem esperar a API (que escala a zero).

## Decisão

- **Locale por request no SSR.** `src/server.ts` envolve o handler do Start em `paraglideMiddleware`:
  o locale é resolvido por request (cookie `locale` → `Accept-Language` → pt-BR) e escopado a ele,
  então `getLocale()` está certo durante a renderização e o `<html lang>` sai no idioma da pessoa.
- **`user.locale` é nulo até a pessoa escolher.** `null` significa "não escolhido": o navegador decide
  até lá. Trocar o idioma em Ajustes grava `user.locale` (migrations 0015 e 0016) **e** o cookie.
  Nunca gravamos o idioma "por dedução".
- **Erros do zod viajam como códigos** (`schedule.count.range`, `amount.tooHigh`…), traduzidos no
  front. As mensagens em pt-BR deixaram de morar dentro do `shared`.
- **E-mails e PDFs falam o idioma de quem recebe**, escolhido no back com `pickLocale`:
  - convite: o de quem tem conta com aquele e-mail, senão o de quem convidou;
  - lembrete diário: o do destinatário;
  - extrato e recibo baixados: o de quem baixa (`user.locale`, depois o cookie e o `Accept-Language`);
  - recibo público: a página fala o idioma do visitante; o PDF, o do dono do contrato.
- **Notificações** seguem salvas por `type`; o texto é montado no front.
- **CI:** um teste falha se faltar chave em um dos idiomas.

## Consequences

- Todo texto novo nasce nos dois JSON; chave sem uso é apagada junto com o código.
- O texto de e-mail e PDF vive no back (`email-templates`, `documents/labels`), fora do Paraglide.
