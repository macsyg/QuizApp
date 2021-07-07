FROM node:14
COPY . /quizes
RUN npm install express amqplib mongodb mongoose cookie-parser bcrypt jsonwebtoken
CMD ["node", "/quizes/quizes.js"]