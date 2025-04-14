# Use smaller and safer Node 22 base image
FROM node:22

# Set working directory
WORKDIR /app


COPY package*.json ./
RUN npm install

# Copy backend source code
COPY . .

# Install dependencies
RUN npm install

# Expose the port your backend listens on
EXPOSE 3000

# Start the backend
CMD ["npm", "start"]
