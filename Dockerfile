# Estágio 1: Dependências e Compilação
FROM node:20-alpine AS builder
WORKDIR /app

# Next.js importa algumas rotas durante a compilação. Este caminho temporário
# permite inicializar o Prisma sem apontar para o banco persistente da aplicação.
ENV DATABASE_URL=file:/tmp/finance-build.db
ENV FINANCE_DATABASE_DIR=/tmp/finance-build-user-finances

RUN apk add --no-cache openssl bash

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npm run build

# Estágio 2: Imagem Final de Produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/prisma/prod.db

RUN apk add --no-cache openssl bash

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Keep the Prisma schema and migrations outside /app/prisma, which is mounted
# as persistent data by the TrueNAS Compose configuration.
COPY --from=builder /app/prisma ./prisma-schema
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/scripts/log-tee.cjs ./scripts/log-tee.cjs

# The app only needs write access to its persistent data and backup directories.
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/prisma/user-finances /app/prisma/logs /bkp \
  && chown -R app:app /app/prisma /bkp
USER app

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["/bin/bash", "-lc", "set -e; mkdir -p /app/prisma/user-finances /app/prisma/logs /bkp; exec > >(node ./scripts/log-tee.cjs /app/prisma/logs/application.log) 2>&1; node ./node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma-schema/schema.prisma; exec node server.js"]
