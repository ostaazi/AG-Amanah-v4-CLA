# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (use lockfile when present)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime image
FROM node:20-alpine
WORKDIR /app

# Serve static build
RUN npm install -g serve

COPY --from=build /app/dist ./dist

ENV PORT=7860
EXPOSE 7860

# -s enables SPA fallback to index.html
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
