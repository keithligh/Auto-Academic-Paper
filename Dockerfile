# =============================================
# Stage 1: Builder (with native compilation tools)
# =============================================
FROM node:20-alpine AS builder

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (for layer caching)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build
RUN npm run db:push

# =============================================
# Stage 2: Production Runtime (minimal image)
# =============================================
FROM node:20-alpine

WORKDIR /app

# Copy only what's needed from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/local.db ./local.db

EXPOSE 5000
CMD ["npm", "start"]
