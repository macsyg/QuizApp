const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const HOST = '0.0.0.0'
const PORT = 8002;

const USERS_ACCESS_TOKEN_SECRET_KEY = 'abcd1234'; // TODO: swap to longer and more complex key on deployment

const app = express();
app.use(cookieParser());
app.use(express.json());

const userSchema = new mongoose.Schema({
    login: String,
    password: String
});

const userModel = mongoose.model('user', userSchema);

mongoose.connect('mongodb://users-db:27017/users', {useNewUrlParser: true});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'CONNECTION ERROR'));

app.post('/create-user', async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const allUsersData = await userModel.find({
        login: req.body.login,
    });
    if (allUsersData.length > 0) {
        res.send("fail");
    }
    else {
        const newUser = new userModel({
            login: req.body.login,
            password: hashedPassword
        })
        newUser.save();
        res.send("ok");
    }
});

app.post('/login', async (req, res) => {
    // authenticating user
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const allUsersData = await userModel.find({
        login: req.body.login,
    });
    if (allUsersData.length != 1) {
        res.send("fail");
    }
    else {
        if (await bcrypt.compare(req.body.password, allUsersData[0].password)) {
            // success, creating jwt token
            const username = req.body.login;
            const user = { name: username }
            const accessToken = jwt.sign(user, USERS_ACCESS_TOKEN_SECRET_KEY, {
                expiresIn: "1h"
            });
            res.json({ accessToken: accessToken });
        }
        else {
            res.send("fail");
        }
    }
});

app.get('/auth-token', authenticateToken, async (req, res) => {
    res.json({ login: res.user });
})

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authentication'];
    const token = authHeader.split(' ')[1];
    if (token == null) {
        return res.sendStatus(401);
    }
    jwt.verify(token, USERS_ACCESS_TOKEN_SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        // token is valid
        req.user = user;
        next();
    });
}

app.listen(PORT, HOST);