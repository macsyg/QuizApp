const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongo = require('mongodb');
const amqp = require("amqplib");

const HOST = '0.0.0.0'
const PORT = 8003;
const RABBITMQ_RETRY_COOLDOWN = 10000;

const USERS_ACCESS_TOKEN_SECRET_KEY = 'abcd1234'; // TODO: swap to longer and more complex key on deployment

const app = express();
app.use(cookieParser());
app.use(express.json());

const MongoClient = mongo.MongoClient;
const quizes_db_url = 'mongodb://quizes-db:27017';

async function addQuizToDatabase(data) {
    MongoClient.connect(quizes_db_url, {useNewUrlParser: true}, (err, client) => {
        if (err) {
            client.close();
            return;
        }
        const quizes_collection = client.db('quizes').collection('quizes');
        const validatedUser = isValidToken(data.user);
        if (validatedUser == null) {
            return;
        }
        // user successfully validated, adding quiz
        quizes_collection.insertOne({
            title: data.title,
            type: data.type,
            user: validatedUser,
            questions: data.questions
        })
    });  
}

connectToRabbitMQ();
async function connectToRabbitMQ() {
    try {
        const amqpServer = "amqp://quizes-queue";
        connection = await amqp.connect(amqpServer);
        channel = await connection.createChannel();
        await channel.assertQueue("quizes-queue");
        channel.consume("quizes-queue", async (data) => {
            const message = JSON.parse(data.content.toString());
            await addQuizToDatabase(message);
            channel.ack(data);
        });
    }
    catch (err) {
        console.log('Error connecting to quizes RabbitMQ');
        setTimeout(connectToRabbitMQ, RABBITMQ_RETRY_COOLDOWN);
    }
}

/*const quiz1 = {
    title: "World Capitals",
    type: "base",
    user: "",
    questions: [
        {
            name: "Capital of Nicaragua?",
            correct: "Managua",
            wrong_1: "Saint John's",
            wrong_2: "N'Djamena",
            wrong_3: "Harare"
        },
        {
            name: "Capital of Peru?",
            correct: "Lima",
            wrong_1: "Palikir",
            wrong_2: "Madrid",
            wrong_3: "Jakarta"
        },
        {
            name: "Capital of The Bahamas?",
            correct: "Nassau",
            wrong_1: "Minsk",
            wrong_2: "Maputo",
            wrong_3: "Ankara"
        },
        {
            name: "Capital of Portugal?",
            correct: "Lisbon",
            wrong_1: "Cairo",
            wrong_2: "Copenhagen",
            wrong_3: "Ottawa"
        },
        {
            name: "Capital of Haiti?",
            correct: "Port-au-Prince",
            wrong_1: "San Marino",
            wrong_2: "Dushanbe",
            wrong_3: "Bucharest"
        },
        {
            name: "Capital of Yemen",
            correct: "Sanaa",
            wrong_1: "Wellington",
            wrong_2: "Havana",
            wrong_3: "Lusaka"
        }
    ]
}

const quiz2 = {
    title: "United States states abbreviations",
    type: "base",
    user: "",
    questions: [
        {
            name: "AK?",
            correct: "Alaska",
            wrong_1: "Arkansas",
            wrong_2: "Kansas",
            wrong_3: "Alabama"
        },
        {
            name: "MO?",
            correct: "Missouri",
            wrong_1: "Mississippi",
            wrong_2: "Minnesota",
            wrong_3: "Montana"
        },
        {
            name: "NE?",
            correct: "Nebraska",
            wrong_1: "Nevada",
            wrong_2: "New Hampshire",
            wrong_3: "New Jersey"
        },
        {
            name: "WV?",
            correct: "West Virginia",
            wrong_1: "Wyoming",
            wrong_2: "Wisconsin",
            wrong_3: "Vermont"
        },
        {
            name: "ID?",
            correct: "Idaho",
            wrong_1: "Indiana",
            wrong_2: "Illinois",
            wrong_3: "Iowa"
        },
        {
            name: "KY?",
            correct: "Kentucky",
            wrong_1: "Kansas",
            wrong_2: "Colorado",
            wrong_3: "California"
        }
    ]
}*/

/*MongoClient.connect(quizes_db_url, {useNewUrlParser: true}, (err, client) => {
    if (err) {
        console.log('err');
        return;
    }
    const quizes_collection = client.db('quizes').collection('quizes');
    quizes_collection.insertMany([quiz1, quiz2]);
});*/

app.get('/all-quizes-titles', authenticateToken, async (req, res) => {
    MongoClient.connect(quizes_db_url, {useNewUrlParser: true}, (err, client) => {
        if (err) {
            client.close();
            return res.sendStatus(404);
        }
        let result_array = []
        const quizes_collection = client.db('quizes').collection('quizes');
        const quizesData = quizes_collection.find({}).toArray(function(err, result) {
            if (err) throw err;
            for (var i = 0; i < result.length; i++) {
                if (result[i].type === 'private' && result[i].user != req.user.name) {
                    continue;
                }
                result_array.push({
                    quiz_id: result[i]._id,
                    title: result[i].title,
                    type: result[i].type,
                    user: result[i].user
                })
            }
            const result_as_json = JSON.stringify(result_array);
            res.json(result_as_json);
        })
    });
});

app.get('/quiz-data', async (req, res) => {
    MongoClient.connect(quizes_db_url, {useNewUrlParser: true}, (err, client) => {
        if (err) {
            client.close();
            return;
        }
        let result_array = []
        const quizes_collection = client.db('quizes').collection('quizes');
        const quizesData = quizes_collection.find({_id: mongo.ObjectId(req.body.quiz_id)}).toArray(function(err, result) {
            if (result.length == 0) {
                return res.sendStatus(404);
            }
            const result_as_json = JSON.stringify(result[0]);
            res.json(result_as_json);
        })
    });
});

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

app.listen(PORT, HOST);