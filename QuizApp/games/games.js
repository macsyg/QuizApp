const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const amqp = require("amqplib");
const socket = require('socket.io');
const axios = require('axios');

const PORT = 8005;
const USERS_ACCESS_TOKEN_SECRET_KEY = ''; // Replace with randomly generated hex key

const app = express();
app.use(cookieParser());
app.use(express.json());

var nextGameId = 1;

const delay = ms => new Promise(res => setTimeout(res, ms));

// gameId -> gameData
const activeGames = {}

// playerName -> gameId
const activePlayers = {}

function deleteGame(gameId) {
    delete activeGames[gameId];
}

connectToRabbitMQ();
async function connectToRabbitMQ() {
    try {
        const amqpServer = "amqp://games-queue";
        connection = await amqp.connect(amqpServer);
        channel = await connection.createChannel();
        await channel.assertQueue("start_game_queue");
        channel.consume("start_game_queue", async (data) => {
            const lobbyData = JSON.parse(data.content.toString());
            await startGame(lobbyData);
            channel.ack(data);
        });
    }
    catch (err) {
        console.log('failed connecting to games RabbitMQ');
        setTimeout(connectToRabbitMQ, 15000);
    }
}

async function startGame(lobbyData) {
    if (lobbyData.quizId == undefined) {
        return;
    }
    axios.get('http://quizes-node:8003/quiz-data', {
        data: {
            quiz_id: lobbyData.quizId
        }
    }).then(async (resp) => {
        if (resp.status != 200) {
            return;
        }
        const quizData = JSON.parse(resp.data);
        const newGame = {
            lobbyCode: lobbyData.code,
            gameId: nextGameId++,
            users: lobbyData.users,
            questions: quizData.questions,
            numberOfQuestions: quizData.questions.length,
            nextQuestion: 0,
            // scores: {},
            scores: [],
            lastAnswer: {},
        }
        for (const user of newGame.users) {
            // newGame.scores[user] = 0;
            var player = {
                username: user,
                pts: 0
            }
            newGame.scores.push(player);
        }
        activeGames[newGame.gameId] = newGame;
        await channel.sendToQueue("game_started_queue", Buffer.from(JSON.stringify({
            code: lobbyData.code,
            gameId: newGame.gameId
        })));
        await runGame(newGame);
    });
}

async function runGame(gameData) {
    await delay(3000);
    for (var i = 0; i < gameData.questions.length; ++i) {
        const question = gameData.questions[i];
        const answers = [
            question.correct,
            question.wrong_1,
            question.wrong_2,
            question.wrong_3
        ]
        const dataToSend = {
            number: i,
            question: question.name,
            answers: answers.sort((a, b) => 0.5 - Math.random())
        }
        io.in(gameData.gameId).emit("question", dataToSend);
        await delay(10000);
        gameData.scores.sort(function (a, b) {
            return b.pts - a.pts;
        });
        io.in(gameData.gameId).emit("leaderboard", gameData.scores, question.correct);
        await delay(5000);
    }
    io.in(gameData.gameId).emit("summary", gameData.scores, gameData.lobbyCode);
    await delay(3000);
}

const server = require('http').Server(app);

const io = socket(server, {
    cors: {
        origin: "*",
    }
});

io.on("connection", socket => {

    socket.on("join-game", function (gameId, authToken) {
        const username = isValidToken(authToken);
        if (username == null) return;
        socket.username = username;
        socket.join(gameId);
    });

    socket.on("answer", function (gameId, questionNumber, answer) {
        const game = activeGames[gameId];
        if (game == undefined) return;
        if (game.lastAnswer[socket.username] == undefined) {
            game.lastAnswer[socket.username] = questionNumber;
        }
        else if (game.lastAnswer[socket.username] >= questionNumber) {
            return;
        }
        else {
            game.lastAnswer[socket.username] = questionNumber;
        }
        if (game.questions[questionNumber].correct === answer) {

            var new_player = true;
            for (let i = 0; i < game.scores.length; i++) {
                if (game.scores[i]['username'] === socket.username) {
                    game.scores[i]['pts']++;
                    new_player = false;
                }
            }
            if (new_player) {
                var player = {
                    username: socket.username,
                    pts: 1
                }
                game.scores.push(player);
            }


            // if (game.scores[socket.username] == undefined) {
            //     game.scores[socket.username] = 1;
            // }
            // else {
            //     game.scores[socket.username]++;
            // }
            socket.emit("correct");
        }
        else {
            socket.emit("wrong", game.questions[questionNumber].correct);
        }
    });
})

// returns 'null' if token is invalid, otherwise returns token's owner's username
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
    console.log('listening on *:8005');
});




