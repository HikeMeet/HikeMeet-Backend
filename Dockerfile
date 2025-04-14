# Use a base image with Node.js
FROM node:18-alpine
 
# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Build the application (e.g., TypeScript or production build)
RUN npm run build

# Expose the application port (e.g., 4000)
EXPOSE 4000

# Start the backend server
CMD ["npm", "run", "dev"]