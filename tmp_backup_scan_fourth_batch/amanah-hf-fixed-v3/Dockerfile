# Hugging Face Docker Space for Vite/React (static build)
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (repo may not include package-lock.json, so use npm install)
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

ENV PORT=7860
EXPOSE 7860

CMD ["serve", "-s", "dist", "-l", "7860"]
