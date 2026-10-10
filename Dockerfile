# Imagen de RP Software. La usa docker-compose.yml; ver la sección "Puesta en marcha" del README.
FROM node:25-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Aplica las migraciones y crea los productos y el usuario admin si faltan. Se ejecuta y termina.
FROM deps AS migrar
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed"]

# La aplicación.
FROM base AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# El servidor autónomo no incluye public/ (íconos, logos, manifest): se copia aparte.
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
