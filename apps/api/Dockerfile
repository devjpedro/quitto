FROM oven/bun:1
WORKDIR /app

# Manifests primeiro: camada de install fica em cache enquanto eles não mudam.
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY e2e/package.json ./e2e/
RUN bun install --frozen-lockfile

# Source depois (o .dockerignore exclui **/node_modules, então não sobrescreve o install).
COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
