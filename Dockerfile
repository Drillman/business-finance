# Build stage
FROM node:22-alpine AS builder

# git is needed to install @drillman/dashboard-ui, a private GitHub dependency (dev only)
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./

# GitHub token with read access to Drillman/dashboard-ui (build stage only, not in the final image)
ARG GITHUB_TOKEN

# Install all dependencies (including dev for building)
# Coolify/build environments may set NODE_ENV=production, so force dev deps here.
RUN git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "ssh://git@github.com/" \
  && git config --global --add url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "git@github.com:" \
  && npm ci --include=dev \
  && rm ~/.gitconfig

# Copy source code
COPY . .

# Build client and server
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY --chown=nodejs:nodejs package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Health check (use 127.0.0.1 instead of localhost to force IPv4)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start the server
CMD ["node", "dist/server/index.js"]
