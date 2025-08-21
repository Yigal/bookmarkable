# Multi-stage Docker build for Bookmark Sync

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/server.js ./
COPY --from=builder --chown=nodejs:nodejs /app/config ./config
COPY --from=builder --chown=nodejs:nodejs /app/middleware ./middleware
COPY --from=builder --chown=nodejs:nodejs /app/routes ./routes
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./.env.example

# Create data directory for SQLite database
RUN mkdir -p data logs && \
    chown -R nodejs:nodejs data logs

# Create startup script
RUN echo '#!/bin/sh\n\
# Create .env from .env.example if it does not exist\n\
if [ ! -f .env ]; then\n\
    echo "Creating .env file from .env.example..."\n\
    cp .env.example .env\n\
fi\n\
\n\
# Run database migrations\n\
echo "Running database migrations..."\n\
npm run migrate:up\n\
\n\
# Start the application\n\
echo "Starting Bookmark Sync server..."\n\
exec "$@"' > /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh && \
    chown nodejs:nodejs /app/docker-entrypoint.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

# Set entrypoint
ENTRYPOINT ["dumb-init", "/app/docker-entrypoint.sh"]

# Default command
CMD ["node", "server.js"]

# Metadata labels
LABEL maintainer="bookmark-sync-team" \
      description="Bookmark Sync Web Application" \
      version="1.0.0" \
      org.opencontainers.image.title="Bookmark Sync" \
      org.opencontainers.image.description="A Chrome extension and web application for bookmark management" \
      org.opencontainers.image.vendor="Bookmark Sync Team" \
      org.opencontainers.image.source="https://github.com/your-username/bookmark-sync"