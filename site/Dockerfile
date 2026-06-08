FROM node:18-alpine


WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]

#npm install i18next react-i18next i18next-browser-languagedetector --save