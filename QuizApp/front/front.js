const express = require('express');
const path = require('path');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const amqp = require("amqplib");
var channel;

const app = express();
const PORT = 80;
const HOST = '0.0.0.0';
const RABBITMQ_RETRY_COOLDOWN = 10000;
const USERS_ACCESS_TOKEN_SECRET_KEY = ''; // Replace with randomly generated hex key

// to serve socket.io on client side
const server = require('http').Server(app);
const io = require('socket.io')(server);

io.on("connection", socket => {
  console.log('connected wtf');
})

// rabbitMQ
connect();
async function connect() {
    try {
        const amqpServer = "amqp://quizes-queue";
        connection = await amqp.connect(amqpServer);
        channel = await connection.createChannel();
        await channel.assertQueue("quizes-queue");
    }
    catch (err) {
        console.log('failed connecting to quizes RabbitMQ');
        setTimeout(connect, RABBITMQ_RETRY_COOLDOWN);
    }
}

app.use(express.urlencoded({
  extended: true
}));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, "static")));

app.get('/', (req, res) => {
    res.render('welcome');
  });

app.post('/', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  const url = 'http://users-node:8002/login';

  axios.post(url, {
    login: username,
    password: password
  }).then(resp => {
    if (resp.data == 'fail') {
      res.render('welcome');
    }
    else {
      res.cookie('auth_token', resp.data.accessToken, {
        maxAge: 300 * 1000,
        httpOnly: true
      });
      res.redirect('/home');
    }
  })
});

app.get('/register', (req, res) => {
  res.render('register', {failure: false});
});

app.post('/register', (req, res) => {
  var username = req.body.username;
  var password = req.body.password; 
  const url = 'http://users-node:8002/create-user';

  axios.post(url, {
    login: username,
    password: password
  }).then(resp => {
    if (resp.data == 'fail') {
      res.render('register', {failure: true});
    }
    else {
      res.render('goback');
    }
  })
});

app.get('/home', authenticateToken, (req, res) => {
  res.render('home', {token: req.cookies['auth_token']});
});

app.get('/add_quiz', authenticateToken, (req, res) => {
  res.render('add_quiz', {token: req.cookies['auth_token']});
});

app.post('/add_quiz', authenticateToken, async (req, res) => {
  var quiz = {};
  quiz.title = req.body['title'];
  quiz.type = req.body['typeslist'];
  quiz.user = req.cookies['auth_token'];

  var qval = req.body.qval;

  q_list = [];

  for(let i = 1; i <= qval; i++) {
    var elem = {};
    elem['name'] = req.body[`question_id${i}`];
    elem['correct'] = req.body[`correct_id${i}`];
    elem['wrong_1'] = req.body[`wrong_1_id${i}`];
    elem['wrong_2'] = req.body[`wrong_2_id${i}`];
    elem['wrong_3'] = req.body[`wrong_3_id${i}`];
    q_list.push(elem);
  }

  quiz.questions = q_list;
  await channel.sendToQueue("quizes-queue", Buffer.from(JSON.stringify(quiz)));
  res.render('home', {token: req.cookies['auth_token']});
});

app.get('/create_lobby', authenticateToken, (req, res) => {
  axios.get('http://lobbies-node:8004/create-new-lobby', {
    headers: {
      'Authentication': 'Bearer ' + req.cookies['auth_token']
    }
  }).then((resp) => {
    if (resp.status == 200) {
      // download all quizes
      var object = JSON.parse(resp.data);
      res.cookie('lobby_code', object.code, {
        maxAge: 300 * 1000,
        httpOnly: true
      });
      res.cookie('is_owner', 'yes', {
        maxAge: 300 * 1000,
        httpOnly: true
      });
      res.redirect(`/lobby/${object.code}`);
    }
    else {
      res.redirect('/home');
    }
  });
});

app.post('/join_lobby', authenticateToken, (req, res) => {
  axios.get('http://lobbies-node:8004/join-with-code', {
    headers: {
      'Authentication': 'Bearer ' + req.cookies['auth_token']
    },
    data: {
      code: req.body.code
    }
  }).then((resp) => {
    if (resp.status == 200) {
      res.cookie('lobby_code', req.body.code, {
        maxAge: 300 * 1000,
        httpOnly: true
      });
      res.cookie('is_owner', 'no', {
        maxAge: 300 * 1000,
        httpOnly: true
      });
      res.redirect(`/lobby/${req.body.code}`);
    }
    else {
      res.redirect('/home');
    }
  });
});

app.get('/lobby/:id', authenticateToken, (req, res) => {
  var json = JSON.stringify(req.cookies);
  var quizes;
  if (req.cookies['is_owner'] === 'yes') {
    axios.get('http://quizes-node:8003/all-quizes-titles', {
        headers: {
          'Authentication': 'Bearer ' + req.cookies['auth_token']
        }
      }).then((resp) => {
        if (resp.status == 200) {
          quizes = JSON.parse(resp.data);
          return res.render('lobby_owner', {code: req.params.id, quizes: quizes, auth_token: req.cookies['auth_token']});
        }
        else {
          res.redirect('/');
        }
      });
  }
  else {
    return res.render('lobby_guest', {code: req.params.id, auth_token: req.cookies['auth_token']});
  }
});

app.get('/log_out', (req, res) => {
  res.clearCookie('auth_token');
  res.clearCookie('lobby_code');
  res.clearCookie('is_owner');
  res.redirect('/');
});

app.get('/quiz/:id', authenticateToken, (req, res) => {
  res.render('question', {auth_token: req.cookies['auth_token'], game_id: req.params.id});
});

function authenticateToken(req, res, next) {
  const authCookie = req.cookies['auth_token'];
  if (authCookie == undefined) {
      return res.redirect('/');
  }
  const token = authCookie;
  if (token == null) {
    return res.redirect('/');
  }
  jwt.verify(token, USERS_ACCESS_TOKEN_SECRET_KEY, (err, user) => {
      if (err) {
        return res.redirect('/');
      }
      // token is valid
      req.user = user;
      next();
  });
}

server.listen(PORT, () => {
  console.log('listening on *:8001');
});

