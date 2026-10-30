# ==========================================
# Stage 1: Build React frontend
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript and bundle assets
RUN npm run build


# ==========================================
# Stage 2: NGINX runtime
# ==========================================
FROM nginx:stable-alpine AS runtime

# Configure NGINX
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=10s \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# Copy production assets
COPY --from=builder /app/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
