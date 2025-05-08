FROM node:18-alpine

# Install pandoc
RUN apk add --no-cache pandoc

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"] 