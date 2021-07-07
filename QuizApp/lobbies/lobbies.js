const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const amqp = require("amqplib");
const socket = require('socket.io');
var cors = require('cors');
var channel; // rabbitMQ channel

const HOST = '0.0.0.0'
const PORT = 8004;
const RABBITMQ_RETRY_COOLDOWN = 10000;
const USERS_ACCESS_TOKEN_SECRET_KEY = 'abcd1234'; // TODO: swap to longer and more complex key on deployment
const LOBBY_CODE_LENGTH = 5;

const gameLobbies = {}
const activeUsers = {}

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors());

const server = require('http').Server(app);

const io = socket(server, {
    cors: {
        origin: "*",
    }
});

function deleteLobby(lobbyCode) {
    const lobbyToDelete = gameLobbies[lobbyCode];
    for (var i = 0; i < lobbyToDelete.users.length; i++) {
        delete activeUsers[lobbyToDelete.users[i]];
    }
    delete gameLobbies[lobbyCode];
}

function deleteUser(username) {
    const lobbyCode = activeUsers[username];
    if (lobbyCode == undefined) return;
    delete activeUsers[username];
    const lobby = gameLobbies[lobbyCode];
    if (lobby.owner == username) {
        io.in(lobbyCode).emit('leave-lobby');
        deleteLobby(lobbyCode);
    }
    else {
        const index = lobby.users.indexOf(username);
        if (index > -1) {
            lobby.users.splice(index, 1);
        }
    }
}

connectToRabbitMQ();
async function connectToRabbitMQ() {
    try {
        const amqpServer = "amqp://games-queue";
        connection = await amqp.connect(amqpServer);
        channel = await connection.createChannel();
        await channel.assertQueue("start_game_queue");
        await channel.assertQueue("game_started_queue");
        channel.consume("game_started_queue", async (data) => {
            const newGameData = JSON.parse(data.content.toString());
            io.in(newGameData.code).emit('game-started', newGameData.gameId);
            //deleteLobby(newGameData.code);
            channel.ack(data);
        });
    }
    catch (err) {
        console.log('failed connecting to games RabbitMQ');
        setTimeout(connectToRabbitMQ, RABBITMQ_RETRY_COOLDOWN);
    }
}

app.get('/join-with-code', authenticateToken, (req, res) => {
    if (activeUsers[req.user.name] != undefined) {
        deleteUser(req.user.name);
    }
    var lobby = gameLobbies[req.body.code];
    if (lobby == undefined) {
        return res.send("INVALID CODE");
    }
    lobby.users.push(req.user.name);
    activeUsers[req.user.name] = req.body.code;
    res.sendStatus(200);
});

app.get('/create-new-lobby', authenticateToken, (req, res) => {
    if (activeUsers[req.user.name] != undefined) {
        deleteUser(req.user.name);
    }
    var newLobbyCode = createLobbyCode(LOBBY_CODE_LENGTH);
    while (gameLobbies[newLobbyCode] != undefined) {
        newLobbyCode = createLobbyCode(LOBBY_CODE_LENGTH);
    }
    gameLobbies[newLobbyCode] = {
        code: newLobbyCode,
        users: [req.user.name],
        owner: req.user.name
    }
    activeUsers[req.user.name] = newLobbyCode;
    var result = {
        code: newLobbyCode
    }
    res.json(JSON.stringify(result));
});

app.get('/set-quiz-id', authenticateToken, (req, res) => {

    if (activeUsers[req.user.name] == undefined) {
        return res.sendStatus(406);
    }
    var userLobby = gameLobbies[activeUsers[req.user.name]];
    if (userLobby == undefined) {
        return res.sendStatus(406);
    }
    if (userLobby.owner != req.user.name) {
        return res.sendStatus(406);
    }
    userLobby.quizId = req.query.quizId;
    res.sendStatus(200);
})

app.get('/start-game', authenticateToken, async (req, res) => {
    if (activeUsers[req.user.name] == undefined) {
        res.sendStatus(406);
    }
    var userLobby = gameLobbies[activeUsers[req.user.name]];
    if (userLobby == undefined) {
        res.sendStatus(406);
    }
    if (userLobby.owner != req.user.name) {
        res.sendStatus(406);
    }
    const gqs = JSON.stringify(userLobby);
    await channel.sendToQueue("start_game_queue", Buffer.from(gqs));
    res.sendStatus(200);
})

/* dodane WYJSCIE Z LOBBY */
app.get('/leave-lobby', authenticateToken, (req, res) => {
    if (activeUsers[req.user.name] == undefined) {
        res.sendStatus(406);
    }
    var userLobby = gameLobbies[activeUsers[req.user.name]];
    if (userLobby == undefined) {
        res.sendStatus(406);
    }
    // if (userLobby.owner != req.user.name) {
    //     // res.sendStatus(406);
    // }
    // const usersList = userLobby.users;

    if (userLobby.owner != req.user.name) {
        // res.sendStatus(406);
        var id = userLobby.users.indexOf(req.user.name);
        if (id >= 0) {
            userLobby.users.splice(id, 1);
        }

        var code = activeUsers[req.user.name];

        delete activeUsers[req.user.name];
        res.sendStatus(200);
        io.in(code).emit('players-update', lobby.users);
    }
    else {
        var code = activeUsers[req.user.name];

        deleteLobby(activeUsers[req.user.name]);
        res.sendStatus(200);
        io.in(code).emit('leave-lobby');
    }
})

function createLobbyCode(length) {
    var result = '';
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (var i = 0; i < length; ++i) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authentication'];
    if (authHeader == undefined) {
        return res.sendStatus(401);
    }
    const token = authHeader.split(' ')[1];
    if (token == null) {
        return res.sendStatus(401);
    }
    jwt.verify(token, USERS_ACCESS_TOKEN_SECRET_KEY, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        // token is valid
        req.user = user;
        next();
    });
}

io.on("connection", socket => {

    socket.on("join-group", function (code, token) {
        const username = isValidToken(token);
        if (username == undefined) return;
        socket.username = username;
        socket.join(code);
    })

    socket.on("new-client", function (code) {
        lobby = gameLobbies[code];
        if (lobby == undefined) {
            return;
        }
        io.in(code).emit('players-update', lobby.users);
    })

})

function isValidToken(token) {
    if (token == null) {
        return null;
    }
    return jwt.verify(token, USERS_ACCESS_TOKEN_SECRET_KEY, (err, user) => {
        if (err) {
            return null;
        }
        return user.name;
    });
}

server.listen(PORT, function() {
    console.log('listening on *:8004');
});

