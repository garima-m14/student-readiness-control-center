FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
RUN npm run generate -w backend && npm run build -w backend
USER node
CMD ["sh", "-c", "npm run db:migrate -w backend && npm run db:seed -w backend && npm start -w backend"]
