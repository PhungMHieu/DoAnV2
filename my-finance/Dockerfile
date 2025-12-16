# Base image
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY apps/ ./apps/
COPY libs/ ./libs/

# Build stage
FROM development AS build

# Build each application separately
RUN npm run build api-gateway
RUN npm run build auth-service
RUN npm run build transaction-service
RUN npm run build report-service
RUN npm run build group-service

# Production stage
FROM node:20-alpine AS production

# Install wget for health checks
RUN apk add --no-cache wget

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built applications from build stage
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nestjs

# Default command (can be overridden)
CMD ["node", "dist/apps/api-gateway/main"]