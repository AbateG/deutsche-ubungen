let questions = [];

async function loadQuestions(path) {
    const response = await fetch(path);
    questions = await response.json();
    startQuiz();
}

loadQuestions('/data/items/articles-a1-1.json');

// #############################################################
// Die Quiz-Engine (identisch zu den anderen JS-Dateien)
// #############################################################

const highScoreElement = document.getElementById('high-score');
const HIGH_SCORE_KEY_ARTIKEL = 'deutschMeisterHighScore_Artikel'; // Eigener Schlüssel!

let currentQuestionIndex = 0;
let score = 0;

const questionTextElement = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-button');
const feedbackElement = document.getElementById('feedback');
const scoreElement = document.getElementById('score');
const explanationElement = document.getElementById('explanation');
const themeToggle = document.getElementById('theme-toggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');

setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const newTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
  setTheme(newTheme);
});

function setTheme(mode) {
  document.body.classList.toggle('theme-dark', mode === 'dark');
  localStorage.setItem('theme', mode);
  themeToggle.innerText = mode === 'dark' ? '☀️' : '🌙';
}

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    scoreElement.innerText = `Punkte: ${score}`;
    highScoreElement.innerText = `Highscore: ${localStorage.getItem(HIGH_SCORE_KEY_ARTIKEL) || 0}`;
    showQuestion();
}

function showQuestion() {
    let currentQuestion = questions[currentQuestionIndex];
questionTextElement.innerText = currentQuestion.prompt;

currentQuestion.choices.forEach(option => {
  const button = document.createElement('button');
  button.innerText = option;
  button.addEventListener('click', () => 
    selectMultipleChoiceAnswer(option, currentQuestion.correctAnswer)
  );
  optionsContainer.appendChild(button);
});

	

    if (currentQuestion.type === 'multiple-choice') {
        currentQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.innerText = option;
            button.addEventListener('click', () => selectMultipleChoiceAnswer(option, currentQuestion.answer));
            optionsContainer.appendChild(button);
        });
    }
    // Andere Fragetypen könnten hier hinzugefügt werden
}

function resetState() {
    nextButton.style.display = 'none';
    feedbackElement.innerText = '';
	explanationElement.style.display = 'none';
    while (optionsContainer.firstChild) {
        optionsContainer.removeChild(optionsContainer.firstChild);
    }
}

function selectMultipleChoiceAnswer(selectedOption, correctAnswer) {
    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
        if (btn.innerText === correctAnswer) {
            btn.classList.add('correct');
        } else if (btn.tagName === 'BUTTON') {
            btn.classList.add('incorrect');
        }
    });

    if (selectedOption === correctAnswer) {
        score++;
        scoreElement.innerText = `Punkte: ${score}`;
        feedbackElement.innerText = "Perfekt!";
        feedbackElement.style.color = 'green';
    } else {
        feedbackElement.innerText = `Falsch. Richtig ist: ${correctAnswer}`;
        feedbackElement.style.color = 'red';
    }

    // DIES IST DIE KORREKTE PLATZIERUNG
    let currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion.explanation) {
        explanationElement.innerText = currentQuestion.explanation;
        explanationElement.style.display = 'block';
    }

    showNextButton();
}

function showNextButton() {
     if (questions.length > currentQuestionIndex + 1) {
        nextButton.style.display = 'block';
    } else {
        questionTextElement.innerText = "Fantastisch! Du hast alle Übungen abgeschlossen!";
        nextButton.style.display = 'none';
        
        const currentHighScore = localStorage.getItem(HIGH_SCORE_KEY_ARTIKEL) || 0;
        if (score > currentHighScore) {
            localStorage.setItem(HIGH_SCORE_KEY_ARTIKEL, score);
            highScoreElement.innerText = `Highscore: ${score}`;
        }
    }
}

nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    showQuestion();
});

startQuiz();