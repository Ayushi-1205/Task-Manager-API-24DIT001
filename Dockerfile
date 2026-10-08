# Practical 11: Backend Dockerfile for Task Manager API
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install production and application dependencies
RUN npm install

# Copy remaining backend source code
COPY . .

# Expose API port
EXPOSE 5000

# Start Express application
CMD ["node", "server.js"]
