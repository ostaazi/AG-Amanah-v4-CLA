# Stage 1: Build the Vite frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Vite embeds VITE_* env vars at build time. Pass via Coolify build args.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_GEMINI_API_KEY
ARG VITE_APP_PEPPER
ARG VITE_CO_PARENT_INVITE_CONTINUE_URL
ARG VITE_EMAIL_INVITATION_WEBHOOK_URL
ARG VITE_EMAIL_INVITATION_WEBHOOK_TOKEN
ARG VITE_SMS_VERIFICATION_WEBHOOK_URL
ARG VITE_SMS_VERIFICATION_WEBHOOK_TOKEN
ARG VITE_PHONE_VERIFICATION_PREFER_GATEWAY
ARG VITE_SMS_TEXTBELT_KEY
RUN npm run build

# Stage 2: Production image (nginx + node email webhook)
FROM nginx:alpine
RUN apk add --no-cache nodejs supervisor

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config with SPA routing + email proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy email webhook server
COPY server/email-invitation-webhook.mjs /opt/email-webhook/server.mjs
COPY .env.example /opt/email-webhook/.env.example

# Supervisord config to run both nginx and email webhook
RUN printf '[supervisord]\nnodaemon=true\nlogfile=/dev/null\nlogfile_maxbytes=0\n\n[program:nginx]\ncommand=nginx -g "daemon off;"\nautorestart=true\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\n[program:email-webhook]\ncommand=node /opt/email-webhook/server.mjs\nautorestart=true\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n' > /etc/supervisord.conf

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisord.conf"]