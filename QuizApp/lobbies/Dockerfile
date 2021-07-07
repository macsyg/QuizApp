FROM node:14
COPY . /lobbies
RUN npm install express cors http socket.io amqplib cookie-parser http jsonwebtoken
CMD ["node", "/lobbies/lobbies.js"]