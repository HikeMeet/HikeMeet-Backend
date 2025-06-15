# Use safe Node base
FROM node:20

RUN apt-get update && \
    apt-get install -y ca-certificates libnss3 dnsutils && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /src/app


COPY package*.json tsconfig.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
