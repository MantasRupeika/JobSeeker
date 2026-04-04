FROM node:22-bookworm-slim

WORKDIR /app/backend

COPY backend/package*.json ./

RUN npm ci

COPY backend ./
COPY frontend ../frontend

EXPOSE 3000

CMD ["npm", "start"]
