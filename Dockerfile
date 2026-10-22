# Estágio 1: Dependências e Compilação
FROM node:20-alpine AS builder
WORKDIR /app

# Next.js importa algumas rotas durante a compilação. Este caminho temporário
# permite inicializar o Prisma sem apontar para o banco persistente da aplicação.
ENV DATABASE_URL=file:/tmp/finance-build.db
ENV FINANCE_DATABASE_DIR=/tmp/finance-build-user-finances

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npm run build

# Estágio 2: Imagem Final de Produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
