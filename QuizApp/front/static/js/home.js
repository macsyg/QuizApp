const origin = window.location.origin;


$(document).ready(function() {
    $('#add-quiz-button').on('click', function() {
        window.location.href = `${origin}/add_quiz`;
    });

    $('#create-lobby-button').on('click', function() {
        window.location.href = `${origin}/create_lobby`;
    });

    $('#log-out-button').on('click', function() {
        window.location.href = `${origin}/log_out`;
    });
});