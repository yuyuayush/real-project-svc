# ==========================================
# Multi-Stage Production Dockerfile
# ==========================================

# --- Stage 1: Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy source code and static assets
COPY src/ ./src/
COPY public/ ./public/

# Compile TypeScript to JavaScript
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

# Set node environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy manifests and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Add non-root user for security
USER node

# Expose server port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start production server
CMD ["node", "dist/server.js"]
