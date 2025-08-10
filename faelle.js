// #############################################################
// Konfiguration
// #############################################################
const DATA_URL = '/data/faelle/a1.json';
const HIGH_SCORE_KEY_FAELLE = 'deutschMeisterHighScore_Faelle';

const highScoreElement = document.getElementById('high-score');
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

let questions = [];
let currentQuestionIndex = 0;
let score = 0;

// #############################################################
// Laden & Normalisieren der Daten
// #############################################################
async function loadQuestions() {
  questionTextElement.innerText = 'Übungen werden geladen...';
  try {
    const res = await fetch('data/faelle/a1.json');
    if (!res.ok) throw new Error('Fehler beim Laden der Daten');
    const raw = await res.json();

    const params = new URLSearchParams(location.search);
    const caseFilter = params.get('case');   // nominativ|akkusativ|dativ|genitiv
    const genderFilter = params.get('gender'); // maskulin|feminin|neutral|plural

    const normalized = raw
      .map(normalizeExercise)
      .filter(q => {
        if (caseFilter && !q.tags?.includes(caseFilter)) return false;
        if (genderFilter && !q.tags?.includes(genderFilter)) return false;
        return true;
      });

    questions = shuffle(normalized);
  } catch (e) {
    questionTextElement.innerText = 'Konnte Übungen nicht laden.';
    console.error(e);
    return;
  }
  startQuiz();
}

function normalizeExercise(item) {
  const isMC = item.type === 'multiple-choice';
  const question = item.prompt ?? item.question ?? '';
  const options = isMC ? item.options : undefined;

  let answer = item.answer;
  if (isMC && answer == null && Array.isArray(item.options) && typeof item.answerIndex === 'number') {
    answer = item.options[item.answerIndex];
  }

  return {
    type: item.type,
    question,
    options,
    answer, // string für beide Typen
    explanation: item.explanation || '',
    tags: item.tags || []
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// #############################################################
// Quiz-Engine
// #############################################################
function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  scoreElement.innerText = `Punkte: ${score}`;
  const hs = parseInt(localStorage.getItem(HIGH_SCORE_KEY_FAELLE) || '0', 10);
  highScoreElement.innerText = `Highscore: ${hs}`;
  showQuestion();
}

function showQuestion() {
  resetState();
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    questionTextElement.innerText = 'Keine passenden Übungen gefunden.';
    return;
  }
  questionTextElement.innerText = currentQuestion.question;

  if (currentQuestion.type === 'multiple-choice' && Array.isArray(currentQuestion.options)) {
    currentQuestion.options.forEach(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerText = option;
      button.addEventListener('click', () => selectMultipleChoiceAnswer(option, currentQuestion.answer));
      optionsContainer.appendChild(button);
    });
  } else if (currentQuestion.type === 'fill-in-the-blank') {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'fill-in-blank-input';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.innerText = 'Antwort prüfen';
    submitButton.style.marginTop = '10px';

    optionsContainer.appendChild(input);
    optionsContainer.appendChild(submitButton);

    submitButton.addEventListener('click', () => {
      selectFillInBlankAnswer(input.value, currentQuestion.answer);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitButton.click();
    });
  } else {
    questionTextElement.innerText = 'Unbekannter Fragetyp.';
  }
}

function resetState() {
  nextButton.style.display = 'none';
  feedbackElement.innerText = '';
  feedbackElement.style.color = '';
  explanationElement.style.display = 'none';
  explanationElement.innerText = '';
  while (optionsContainer.firstChild) optionsContainer.removeChild(optionsContainer.firstChild);
}

function selectMultipleChoiceAnswer(selectedOption, correctAnswer) {
  Array.from(optionsContainer.children).forEach(btn => {
    if (btn.tagName === 'BUTTON') {
      btn.disabled = true;
      if (btn.innerText === correctAnswer) {
        btn.classList.add('correct');
      } else {
        btn.classList.add('incorrect');
      }
    }
  });

  if (normalize(selectedOption) === normalize(correctAnswer)) {
    score++;
    scoreElement.innerText = `Punkte: ${score}`;
    feedbackElement.innerText = 'Perfekt!';
    feedbackElement.style.color = 'green';
  } else {
    feedbackElement.innerText = `Falsch. Richtig ist: ${correctAnswer}`;
    feedbackElement.style.color = 'red';
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (currentQuestion.explanation) {
    explanationElement.innerText = currentQuestion.explanation;
    explanationElement.style.display = 'block';
  }
  showNextButton();
}

function selectFillInBlankAnswer(userAnswer, correctAnswer) {
  const inputField = document.getElementById('fill-in-blank-input');
  const submitBtn = optionsContainer.querySelector('button');
  if (inputField) inputField.disabled = true;
  if (submitBtn) submitBtn.disabled = true;

  if (normalize(userAnswer) === normalize(correctAnswer)) {
    score++;
    scoreElement.innerText = `Punkte: ${score}`;
    feedbackElement.innerText = 'Genau richtig!';
    feedbackElement.style.color = 'green';
    if (inputField) inputField.style.borderColor = 'green';
  } else {
    feedbackElement.innerText = `Knapp daneben. Richtig ist: ${correctAnswer}`;
    feedbackElement.style.color = 'red';
    if (inputField) inputField.style.borderColor = 'red';
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (currentQuestion.explanation) {
    explanationElement.innerText = currentQuestion.explanation;
    explanationElement.style.display = 'block';
  }
  showNextButton();
}

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function showNextButton() {
  if (questions.length > currentQuestionIndex + 1) {
    nextButton.style.display = 'block';
  } else {
    questionTextElement.innerText = 'Fantastisch! Du hast alle Übungen abgeschlossen!';
    nextButton.style.display = 'none';

    const currentHighScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY_FAELLE) || '0', 10);
    if (score > currentHighScore) {
      localStorage.setItem(HIGH_SCORE_KEY_FAELLE, String(score));
      highScoreElement.innerText = `Highscore: ${score}`;
    }
  }
}

nextButton.addEventListener('click', () => {
  currentQuestionIndex++;
  showQuestion();
});

// Start
loadQuestions();
