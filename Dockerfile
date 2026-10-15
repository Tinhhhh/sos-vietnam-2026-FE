# ==========================================
# Stage 1: build the Vite app
# ==========================================
FROM node:24-alpine AS builder

WORKDIR /build

# Cache dependencies layer
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# VITE_API_URL stays empty: the browser calls /api on the same origin and nginx proxies it.
RUN npm run build

# ==========================================
# Stage 2: nginx serves the build and proxies /api, /ws to the backend
# ==========================================
FROM nginx:1.27-alpine

# The nginx image renders /etc/nginx/templates/*.template with envsubst at start-up.
# Only variables that exist in the environment are replaced, so nginx's own $host etc. survive.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /build/dist /usr/share/nginx/html

# Render injects PORT; BACKEND_URL must be set on the service (e.g. https://sos-vietnam-be.onrender.com)
ENV PORT=10000
EXPOSE 10000
