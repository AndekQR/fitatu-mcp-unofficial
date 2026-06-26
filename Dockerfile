# Node.js 22.18.0+ required for native type stripping support
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY *.ts *.json ./
COPY ./src/ ./src/
COPY .env ./

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
