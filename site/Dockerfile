FROM node:18-alpine
ENV http_proxy="http://cache.univ-pau.fr:3128"
ENV https_proxy="http://cache.univ-pau.fr:3128"
ENV HTTP_PROXY="http://cache.univ-pau.fr:3128"
ENV HTTPS_PROXY="http://cache.univ-pau.fr:3128"
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
