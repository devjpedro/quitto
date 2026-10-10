# Lighthouse por rota (celular e desktop)

`scripts/lighthouse.ts` mede 11 rotas (4 públicas, 7 logadas como `agora@demo.quitto.dev`) em duas formas e grava `baseline.json` e `baseline.md`. Mede um **build de produção servido localmente**, não o `vite dev`.

## Passo a passo (da raiz do repo)

1. Banco e MinIO de pé (`docker-compose up -d`) e o seed: `bun --env-file=.env run --filter @quitto/api seed:demo`.
2. API na porta 3000: `cd apps/api && bun --env-file=../../.env run src/index.ts`.
3. Build do web com preset Node: `cd apps/web && NITRO_PRESET=node-server bun run build`.
4. Servidor do build na 3002: `cd apps/web && PORT=3002 API_URL=http://localhost:3000 node .output/server/index.mjs`.
5. A frente na 3001: `cd e2e && bun scripts/lighthouse.ts proxy` (`/api/*` vai para a 3000, o resto para a 3002; comprime texto em Brotli/gzip; `NO_COMPRESS=1` desliga).
6. Medir, a partir de `e2e/`: `bun scripts/lighthouse.ts [--runs N] [--only login,home] [--forms mobile,desktop] [--out dir] [--name arquivo]`.
   `--render <json>` só reescreve o `.md` de um JSON já medido.

Saída padrão: `.superpowers/sdd/2026-10-09-lighthouse/`. O script usa o Chromium do Playwright (`CHROME_PATH`, se não definido). `--runs N` guarda a rodada mediana da Performance e a mediana de cada categoria. Uma rodada oscila uns ±5 pontos de Performance no celular: use `--runs 5` ou mais para validar.

## O que difere da Vercel e do Fly

- **Proxy de `/api`:** o preset local do Nitro não reescreve `/api/*` (na Vercel, a rewrite vai para o Fly); o proxy do passo 5 faz esse papel, sem o salto de rede.
- **Compressão:** o servidor Node do Nitro manda texto cru; a Vercel manda Brotli. Sem `NO_COMPRESS=1` o proxy imita isso (qualidade 5, a Vercel pré-comprime em nível mais alto).
- **CDN, HTTP/2 e cache de borda:** localhost é HTTP/1.1, sem CDN, sem latência de rede e sem cold start. O throttling do Lighthouse (celular: 4G lento simulado) é o único atraso de rede.
- **SSR e API:** a Vercel roda o SSR em `gru1` e chama a API no Fly (`gru`); aqui tudo é local, então o TTFB é otimista.
