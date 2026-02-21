# ─── Build Stage ───
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production Stage ───
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Run migrations and start
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER nestjs
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
