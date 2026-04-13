FROM node:20-slim

WORKDIR /app

# Install system dependencies (needed for Prisma)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client using the new schema location
RUN npx prisma generate --schema=src/prisma/schema.prisma

EXPOSE 3000

# Push the Prisma schema to the database on startup using the explicit schema path
CMD mkdir -p /app/database && npx prisma db push --accept-data-loss --schema=src/prisma/schema.prisma && npm start
