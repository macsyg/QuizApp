var questions = 0;
var text = `<div class="quiz_elem">
<label for="question">Question</label>
<input type="text" placeholder="question" name="question" required>
<label for="correct">Correct Answer</label>
<input type="text" placeholder="" name="correct" required>
<label for="wrong_1">Wrong Answer nr.1</label>
<input type="text" placeholder="" name="wrong_1" required>
<label for="wrong_2">Wrong Answer nr.2</label>
<input type="text" placeholder="" name="wrong_2" required>
<label for="wrong_3">Wrong Answer nr.3</label>
<input type="text" placeholder="" name="wrong_3" required>
</div>`;
function createQuestion() {
    var text = `<div class="quiz_elem">
<div class="field-quiz">
<label for="question_id${questions}">Question</label>
<input type="text" placeholder="question" name="question_id${questions}" required>
<br>
<label for="correct_id${questions}">Correct Answer</label>
<input type="text" placeholder="" name="correct_id${questions}" required>
<br>
<label for="wrong_1_id${questions}">Wrong Answer nr.1</label>
<input type="text" placeholder="" name="wrong_1_id${questions}" required>
<br>
<label for="wrong_2_id${questions}">Wrong Answer nr.2</label>
<input type="text" placeholder="" name="wrong_2_id${questions}" required>
<br>
<label for="wrong_3_id${questions}">Wrong Answer nr.3</label>
<input type="text" placeholder="" name="wrong_3_id${questions}" required>
</div>
</div>`;
    return text;
}

function addQuestion() {
    if (questions < 20) {
        questions++;
        $('#quiz').append(createQuestion());
        $('#qval').val(questions);
        // document.getElementById("quiz").innerHTML += createQuestion();
        // document.getElementById("qval").value = questions;
        // alert(questions);
    }
}

$(document).ready(function() {
    $('#add_q').click(function(event) {
        event.stopPropagation()
        addQuestion();
    });
    $('#leave-button').on('click', function() {
        window.location.href = `http://localhost:8001/home`;
    });
});