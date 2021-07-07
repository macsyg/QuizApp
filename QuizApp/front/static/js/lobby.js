var chosenQuiz = "";

const origin = window.location.origin;
const socketUrl = ''; // replace with lobbies service public address, locally: localhost:8005
const socket = io(socketUrl);
const code = document.getElementById("lobby-code").innerHTML;
const authToken = document.getElementById("auth-token").innerHTML;

socket.emit('join-group', code, authToken);

socket.on('players-update', (players) => {
    content = '';
    for (const player of players) {
        content += player + '<br>';
    }
    document.getElementById("users-list").innerHTML = content;
});

socket.on('game-started', (gameId) => {
    window.location.href = `${origin}/quiz/${gameId}`;
})

/* dodane WYJSCIE Z LOBBY */
socket.on('leave-lobby', () => {
    window.location.href = `${origin}/home`;
})

socket.emit('new-client', code);

$("input:checkbox").on('click', function() {
    var $current = $(this);
    if ($current.is(":checked")) {
        var group = "input:checkbox[name='" + $current.attr("name") + "']";
        $(group).prop("checked", false);
        $current.prop("checked", true);
    } 
    else {
        $current.prop("checked", false);
    }

    chosenQuiz = $current.attr("value");
});

$('#start-button').on('click', function() {
    $.ajax({
        url: `${socketUrl}/set-quiz-id`,
        type: 'GET',
        headers: {
            'Authentication': 'Bearer ' + document.getElementById("auth-token").innerHTML
        },
        data: {
            quizId: chosenQuiz
        },
        success: function(resp) {
            $.ajax({
                url: `${socketUrl}/start-game`,
                type: 'GET',
                headers: {
                    'Authentication': 'Bearer ' + document.getElementById("auth-token").innerHTML
                }
            })
        }
    })
});

/* dodane WYJSCIE Z LOBBY */
$('#leave-button').on('click', function() {
    $.ajax({
        url: `${socketUrl}/leave-lobby`,
        type: 'GET',
        headers: {
            'Authentication': 'Bearer ' + document.getElementById("auth-token").innerHTML
        },
        success: function(resp) {
            window.location.href = `${origin}/home`;
        }
    })
});

