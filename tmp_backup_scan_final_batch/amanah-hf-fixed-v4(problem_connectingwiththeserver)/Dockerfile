# Hugging Face Docker Space for Vite/React (static build)
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (no package-lock.json in repo, so use npm install)
COPY package.json ./
RUN npm install

# Copy app source and build
COPY . .
RUN npm run build

# Runtime image: serve static dist
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

# Hugging Face Spaces expects port 7860 by default (or app_port in README)
ENV PORT=7860
EXPOSE 7860

CMD ["serve", "-s", "dist", "-l", "7860"]
