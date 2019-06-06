FROM buildkite/puppeteer:latest
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "npm", "run", "serve" ]
EXPOSE 3000