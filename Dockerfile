FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --include=dev

COPY backend/ backend/
COPY frontend/ frontend/
ENV CUADRA_EMBEDDED_API=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run db:postgres:generate -w backend && npm run build

ENV NODE_ENV=production
USER node
CMD ["sh", "-c", "npm run db:postgres:migrate -w backend && exec node node_modules/next/dist/bin/next start frontend"]
