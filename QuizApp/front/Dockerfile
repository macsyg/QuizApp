FROM node:14
COPY . /front
RUN npm install axios http socket.io amqplib express cookie-parser ejs jsonwebtoken
CMD ["node", "/front/front.js"]