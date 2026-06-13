# Cron de lembretes — Fly scheduled Machine

O sweep diário roda como uma **scheduled Machine** no mesmo app Fly, usando a mesma imagem.

## Provisionar (1×)

```bash
fly machine run . \
  --schedule daily \
  --app <nome-do-app> \
  --entrypoint "bun run cron:reminders"
```

- `--schedule daily`: o Fly sobe a Machine 1×/dia, roda o entrypoint e a Machine encerra.
- Reusa os secrets do app (`DATABASE_URL` etc.) — **nenhum secret novo**.
- O sweep é idempotente (`dedupeKey`), então reexecuções não duplicam lembretes.

## Verificar

```bash
fly machine list --app <nome-do-app>   # deve listar a machine agendada
fly logs --app <nome-do-app>           # procurar "[cron:reminders] criados/garantidos N lembretes"
```

## Fuso horário (limitação conhecida da 5a)

`runReminderSweep()` usa `todayISO()` em **UTC** (`new Date().toISOString().slice(0, 10)`).
Perto da meia-noite local (Brasil, UTC-3) a data de referência pode adiantar/atrasar um dia
em relação ao relógio do usuário. O impacto é baixo e se autocorrige:

- o `dedupeKey` (`reminder:<tipo>:<installmentId>`) impede duplicatas entre execuções;
- a execução do dia seguinte reconcilia o estado.

Se quiser eliminar o drift, defina `TZ` na Machine agendada (ou compute a data local via
`Intl.DateTimeFormat` antes de chamar `computeReminders`) — a função pura `computeReminders`
não muda; só a data passada a ela.

## Trocar de gatilho no futuro

`runReminderSweep()` é uma função isolada. Para mover o gatilho para um endpoint HTTP
(disparado por GitHub Actions, por ex.), basta exportá-la por uma rota protegida — sem tocar
no domínio (`computeReminders`).
