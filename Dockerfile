FROM node:20-slim

WORKDIR /app

# Install system dependencies (needed for Prisma)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

# Push the Prisma schema to the database on startup to ensure tables exist
CMD npx prisma db push --accept-data-loss && npm start
