# Use Node.js LTS (v20)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose frontend port
EXPOSE 3001

# Start the application in development mode
CMD ["npm", "run", "dev"]
