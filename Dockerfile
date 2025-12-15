FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first (better build caching)
COPY backend/package.json backend/package-lock.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy backend source code
COPY backend .

# Expose backend port
EXPOSE 4000

# Start the server
CMD ["npm", "start"]
