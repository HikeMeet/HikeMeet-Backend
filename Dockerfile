# Use smaller and safer Node 22 base image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files and install deps first (better caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port your backend listens on
EXPOSE 3000

# Start the backend
CMD ["npm", "start"]
