FROM node:14
COPY . /games
RUN npm install express axios socket.io http amqplib cookie-parser http jsonwebtoken
CMD ["node", "/games/games.js"]