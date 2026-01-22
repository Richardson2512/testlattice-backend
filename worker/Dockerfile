# Worker service Dockerfile
# Uses Node 20 on Debian Bookworm for Playwright compatibility

FROM node:20-bookworm

WORKDIR /app

# Create non-root user FIRST (before installing Playwright)
# This ensures Playwright browsers are installed in /home/worker/.cache/ms-playwright/
RUN groupadd -r worker && useradd -r -g worker -m worker

# Copy package files first for better layer caching
COPY package*.json ./

# Install npm dependencies as root (for global access)
RUN npm ci

# Change ownership of app directory to worker
RUN chown -R worker:worker /app

# Switch to worker user BEFORE installing Playwright
# This ensures browsers are installed in /home/worker/.cache/ms-playwright/
USER worker

# Install Playwright browsers with system dependencies
# Must run as worker user so browsers go to correct cache location
# Note: --with-deps requires root, so we install deps separately first
USER root
RUN npx playwright install-deps chromium
USER worker
RUN npx playwright install chromium

# Copy source code (as worker)
USER root
COPY . .
RUN chown -R worker:worker /app
USER worker

# Build TypeScript
RUN npm run build

# Set environment
ENV NODE_ENV=production

# Verify Playwright installation path (debug - can be removed later)
RUN ls -la /home/worker/.cache/ms-playwright/ || echo "Warning: Playwright cache not found"

# Start the worker directly (bypass npm to avoid dotenv auto-injection)
CMD ["node", "dist/index.js"]
