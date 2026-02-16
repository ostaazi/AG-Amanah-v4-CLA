# Amanah - Hugging Face Docker Space build
# Multi-stage build: build Vite app then serve static dist on port 7860

FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Build (tsc + vite build)
RUN npm run build

# Runtime image
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh

EXPOSE 7860
CMD ["sh", "./entrypoint.sh"]
