# Worker service Dockerfile
# Uses Node 18 on Debian Bullseye for Playwright compatibility

FROM node:18-bullseye

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Install Playwright chromium with system dependencies
# This MUST happen at build time to avoid cold-start failures
RUN npx playwright install --with-deps chromium

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user for security
RUN groupadd -r worker && useradd -r -g worker worker
RUN chown -R worker:worker /app
USER worker

# Set environment
ENV NODE_ENV=production

# Start the worker
CMD ["node", "dist/index.js"]
