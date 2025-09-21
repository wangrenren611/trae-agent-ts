# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S trae-agent -u 1001

# Change ownership of the app directory
RUN chown -R trae-agent:nodejs /app
USER trae-agent

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Expose volume for workspace
VOLUME ["/workspace"]

# Set entrypoint
ENTRYPOINT ["node", "/app/dist/cli.js"]

# Default command
CMD ["--help"]