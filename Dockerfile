# Use safe Node base
FROM node:22

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Expose and run
EXPOSE 3000
CMD ["npm", "start"]
