FROM node:14
COPY . /users
RUN npm install express mongo mongoose cookie-parser bcrypt jsonwebtoken
CMD ["node", "/users/users.js"]