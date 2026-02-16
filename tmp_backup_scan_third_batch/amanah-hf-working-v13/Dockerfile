# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

# Cap Node heap to reduce OOM-kills on small builders
ENV NODE_OPTIONS=--max-old-space-size=1024

# Install deps (no lockfile required)
COPY package.json package-lock.json* npm-shrinkwrap.json* ./
RUN npm install --no-audit --no-fund

# Build
COPY . .
RUN npm run build

# Runtime image
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 7860
CMD ["./entrypoint.sh"]
