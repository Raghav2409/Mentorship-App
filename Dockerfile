FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/uploads ./uploads

# Copy necessary files
COPY .env.example ./
COPY drizzle.config.ts ./

# Create uploads directory if it doesn't exist
RUN mkdir -p uploads && chmod 777 uploads

# Expose the application port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]