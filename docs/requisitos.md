# Requisitos — Quitto

Documento de requisitos do Quitto, um sistema de **gestão de contratos parcelados**:
compras parceladas, aluguéis e acordos entre partes (ou solo) — com contratos, parcelas,
comprovantes, quitação, aprovação/contestação, notificações e dashboard.

> Reflete o comportamento **atual** do produto. Para a visão técnica (topologia, modelo de
> dados, fluxos), veja [arquitetura.md](arquitetura.md).

## 1. Visão geral

O objetivo é deixar **cada parcela no seu lugar**: registrar um contrato, acompanhar o
cronograma de parcelas, anexar comprovantes de pagamento e, quando há outra parte envolvida,
aprovar ou contestar cada pagamento até a quitação. O produto atende cenários típicos como:

- **Compra parcelada** — um bem de valor alto dividido em muitas parcelas mensais.
- **Aluguel ou mensalidades** — um acordo de parcelas iguais ao longo de vários meses.

O sistema funciona **solo** (só o dono acompanha) ou **entre partes** (dono convida pagador
e/ou aprovador, com controle de acesso por papel).

## 2. Requisitos funcionais

### 2.1 Autenticação e conta

- Cadastro e login por **e-mail/senha** e, opcionalmente, **Google** (login social).
- **Verificação de e-mail** obrigatória em produção (com reenvio no login); auto-login após
  verificar.
- **Redefinição de senha** (esqueci minha senha, por e-mail) e **troca de senha** logado
  (com confirmação e exibir/ocultar senha).
- **Rate limiting** nas rotas de autenticação (defesa contra força bruta).
- **Sessão por cookie first-party** (o front e a API são same-origin via reverse-proxy).
- **LGPD:** exportar os próprios dados (JSON) e **excluir a conta** — com cascata (contratos,
  parcelas, participações) e purga dos arquivos no storage.

### 2.2 Contratos

- Criar contrato informando título, descrição (opcional) e o **papel do dono** (`comprador`
  ou `vendedor`).
- **Cronograma de parcelas** em dois modos:
  - **Automático:** valor total + nº de parcelas + 1º vencimento → divisão mensal igual (o
    resto em centavos vai para as primeiras parcelas).
  - **Personalizado:** parcelas com valor e vencimento individuais. Ao alternar de automático
    para personalizado, os valores já preenchidos são **herdados** (e os vencimentos, quando
    o 1º vencimento foi informado).
- **Situação do contrato:** `ativo`, `concluído` ou `cancelado`.
- Editar uma parcela (valor/vencimento); **excluir** o contrato (dono) ou **sair** do contrato
  (participante).

### 2.3 Parcelas

- Cada parcela tem **sequência**, **valor** (centavos), **vencimento** (data) e **situação**.
- Máquina de estados da parcela: `pendente` → `aguardando confirmação` → `confirmada` /
  `contestada` → `paga`. Sem necessidade de confirmação, vai direto a `paga`.
- **Atraso:** uma parcela está atrasada quando o vencimento já passou e ela não está paga nem
  aguardando confirmação.

### 2.4 Participantes e convites

- O dono adiciona **participantes** (slots) com papel: **comprador** e **vendedor** são
  únicos por contrato; **espectador** (viewer) é ilimitado.
- **Convite por e-mail:** gera um link com token que **expira em 7 dias**; o e-mail é
  best-effort (se o envio falhar, o convite não fica órfão e o link pode ser copiado).
- O convidado vê uma **prévia do contrato** (quem convidou, valor total, nº de parcelas,
  partes) antes de decidir.
- **Aceitar** (vincula o participante à conta, validando que o e-mail confere) ou **recusar**;
  em ambos os casos o **dono é notificado**. O convite pode ser **reenviado** (gera novo token).
- **RBAC por contrato:** quem não participa não acessa o contrato (nem vaza o título).

### 2.5 Comprovantes e aprovação

- O **pagador** anexa o comprovante via **URL pré-assinada** (upload direto ao storage; o
  arquivo nunca passa pela API). Tipos aceitos: PDF, JPEG, PNG, até 10 MB.
- Se o contrato **exige confirmação**: o envio leva a parcela a `aguardando confirmação`; o
  **aprovador** então **confirma** (→ `confirmada`/quitada) ou **contesta** (→ `contestada`,
  com motivo), e o pagador pode reenviar.
- Se **não exige confirmação**: o envio do comprovante (ou marcar como paga) quita direto.
- Cada transição gera **evento de auditoria** e **notificação** para a contraparte.

### 2.6 Notificações e lembretes

- **Notificações in-app** dos eventos: comprovante enviado, pagamento confirmado/contestado,
  parcela paga, convite aceito/recusado, participante saiu.
- **Lembretes** de parcelas: a **vencer** (3 dias antes) e **vencidas**.
- Notificações têm **deep-link** para a parcela e usam **chave de deduplicação** (não repete
  o mesmo aviso). Marcar como lida individual ou todas.

### 2.7 Dashboard

- Visão consolidada: total **a pagar / a receber**, parcelas **atrasadas**, **contratos
  ativos**, e as **próximas parcelas** com deep-link para abrir o detalhe.

### 2.8 Documentos e exportação

- **Recibo de quitação** e **extrato** do contrato em **PDF**.
- **Exportação CSV** das parcelas.

## 3. Requisitos não-funcionais

### 3.1 Acessibilidade

- **WCAG 2.2 AA.** Verificado automaticamente com **axe** no e2e (rotas autenticadas e
  login). Inclui foco gerenciado em diálogos/drawers, navegação por teclado, e alvos de
  toque ≥ 24px.

### 3.2 Performance

- **Code-splitting** por rota (lazy) e chunking de vendor; **orçamento Lighthouse** no CI.
- **Cold start gracioso:** a API escala a zero (Fly) — o front trata isso com warm-up,
  retry+timeout no bootstrap de sessão e **skeletons** de marca (sem tela branca/F5).

### 3.3 Segurança

- **RBAC por contrato** (capabilities por papel: pagador anexa/paga; aprovador confirma/contesta;
  espectador só lê).
- **Sessão first-party** (cookie), **rate limiting** de auth, **URLs pré-assinadas** com
  expiração curta (5 min) e validação de tipo/tamanho do arquivo.
- **Validação de entrada** com Zod (contratos e schemas compartilhados).
- **Observabilidade sem vazar PII:** o Sentry tem `sendDefaultPii: false` e um scrub que
  remove headers, cookies e query string antes de enviar — nunca envia token de sessão,
  cookie ou parâmetros sensíveis de auth.

### 3.4 Observabilidade e operação

- **Sentry** (erros de código, web + API) — só em produção, ligado por DSN.
- **Uptime monitoring** externo (UptimeRobot) na home, calibrado para **não** anular o
  scale-to-zero da API.
- **CI como gate:** lint, typecheck, testes e build + e2e precisam passar; deploy de produção
  orquestrado (migrate → deploy → smoke).

### 3.5 Internacionalização e estilo

- **UI e conteúdo em pt-BR**; **código em inglês** (identificadores, rotas, comentários).
- Valores monetários em **centavos inteiros**; datas em **ISO** (YYYY-MM-DD) com máscara pt-BR
  (sem drift de fuso).

### 3.6 Confiabilidade e qualidade

- **TDD**, migrations versionadas (Drizzle), suíte e2e (Playwright + axe) dos fluxos críticos.

## 4. Fora de escopo (não-objetivos)

Itens deliberadamente **fora** do produto atual (candidatos a versões futuras):

- Contratos **recorrentes** de verdade (frequência configurável, prazo indeterminado, renovação)
  e **juros/multa** automáticos.
- **OCR** de comprovante; **pagamento real** / integração bancária (PIX, boleto).
- **Multi-tenant** / organizações; **assinatura digital**.
- **App mobile** nativo; notificações por push/e-mail além das transacionais existentes.

## 5. Glossário

| Termo | Significado |
|---|---|
| **Dono** | Quem criou o contrato (papel `comprador` ou `vendedor`). |
| **Pagador** | Quem anexa comprovante e paga (papel `comprador`, ou o dono se não houver comprador vinculado). |
| **Aprovador** | Quem confirma/contesta o pagamento (papel `vendedor`, ou o dono se não houver vendedor vinculado). |
| **Espectador** | Participante que só visualiza (sem capacidade de pagar/aprovar). |
| **Situação da parcela** | `pendente` · `aguardando confirmação` · `confirmada` · `contestada` · `paga`. |
| **Direção** | `pagar` ou `receber` — perspectiva do usuário sobre o valor. |
