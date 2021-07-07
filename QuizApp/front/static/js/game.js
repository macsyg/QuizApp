const origin = window.location.origin;
// socketUrl for local usage - on cloud should be replaced with
// games service's public address
const socketUrl = origin.replace('8001', '8005');
const socket = io(socketUrl);
const gameId = parseInt(document.getElementById('game-id').innerHTML);
const authToken = document.getElementById('auth-token').innerHTML;
var currentQuestion;
var lastClickedId;
socket.emit('join-game', gameId, authToken);

document.getElementById('leaderboard').style.display = "none";

socket.on('question', (questionData) => {
    document.getElementById('leaderboard').style.display = "none";
    document.getElementById('container').style.display = "block";
    currentQuestion = questionData;
    document.getElementById("answers-space").style.display = 'flex';
    document.getElementById("question-box").innerHTML = (questionData.number + 1) + '. ' + questionData.question;
    document.getElementById("answer-A").innerHTML = questionData.answers[0];
    document.getElementById("answer-B").innerHTML = questionData.answers[1];
    document.getElementById("answer-C").innerHTML = questionData.answers[2];
    document.getElementById("answer-D").innerHTML = questionData.answers[3];
    document.getElementById("answer-A").style.backgroundColor = 'white';
    document.getElementById("answer-B").style.backgroundColor = 'white';
    document.getElementById("answer-C").style.backgroundColor = 'white';
    document.getElementById("answer-D").style.backgroundColor = 'white';
});

$('.answer-button').on('click', function() {
    lastClickedId = $(this).attr("id");
    socket.emit('answer', gameId, currentQuestion.number, $(this).html());
});

socket.on('correct', () => {
    document.getElementById(lastClickedId).style.backgroundColor = 'green';
});

function markIfCorrect(id, correct) {
    const e = document.getElementById(id);
    if (e.innerHTML === correct) {
        e.style.backgroundColor = 'green';
    }
}

socket.on('wrong', (correct) => {
    document.getElementById(lastClickedId).style.backgroundColor = 'red';
    markIfCorrect('answer-A', correct);
    markIfCorrect('answer-B', correct);
    markIfCorrect('answer-C', correct);
    markIfCorrect('answer-D', correct);
});

socket.on('leaderboard', (scores) => {
    document.getElementById('leaderboard').style.display = "block";
    document.getElementById('container').style.display = "none";
    var content = '';
    for (let i = 0; i < scores.length; i++) {
        content += scores[i]['username'] + ' ' + scores[i]['pts'] + ' pts<br>';
    }
    document.getElementById('leaderboard').innerHTML = content;
});

socket.on('summary', (scores, lobbyCode) => {
    document.getElementById('leaderboard').style.display = "block";
    document.getElementById('container').style.display = "none";
    var content = '';
    for (let i = 0; i < scores.length; i++) {
        content += scores[i]['username'] + ' ' + scores[i]['pts'] + ' pts<br>';
    }
    document.getElementById('leaderboard').innerHTML = content;
    window.location.href = `${origin}/lobby/${lobbyCode}`;
});


