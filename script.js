// #############################################################
// Config & utilities
// #############################################################

const bodyDataset = document.body?.dataset || {};
const topic = (bodyDataset.topic || inferTopicFromPath()).toLowerCase();
const level = (bodyDataset.level || 'a1').toLowerCase();
const DATA_URL = `data/${topic}/${level}.json`;
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

function inferTopicFromPath() {
  const p = location.pathname.toLowerCase();
  if (p.includes('artikel')) return 'artikel';
  if (p.includes('faelle') || p.includes('fälle')) return 'faelle';
  if (p.includes('wortschatz')) return 'wortschatz';
  return 'grammatik';
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Accepts multiple schemas and normalizes into your current format
function normalizeItem(item) {
  // type
  let type = item.type || (item.options ? 'multiple-choice' : 'fill-in-the-blank');
  if (type === 'mcq') type = 'multiple-choice';

  // question/prompt
  const question = item.question || item.prompt || '';

  // options (may be absent for fill-in)
  const options = Array.isArray(item.options) ? item.options : null;

  // answer (string for your current engine)
  let answer = item.answer;
  if (answer === undefined && typeof item.answerIndex === 'number' && options) {
    answer = options[item.answerIndex];
  }

  // explanation
  const explanation = item.explanation || '';

  return { type, question, options, answer, explanation };
}

function normalizeArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeItem).filter(q =>
    q.question && (q.type === 'fill-in-the-blank' ? typeof q.answer === 'string' : Array.isArray(q.options))
  );
}

// #############################################################
// State & elements
// #############################################################

let questions = [];           // normalized questions
let order = [];               // shuffled indices
let currentQuestionIndex = 0; // pointer within order
let score = 0;

const HIGH_SCORE_KEY = `deutschMeisterHighScore_${topic}_${level}`;

const highScoreElement = document.getElementById('high-score');
const questionTextElement = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-button');
const feedbackElement = document.getElementById('feedback');
const scoreElement = document.getElementById('score');
const explanationElement = document.getElementById('explanation');

// #############################################################
// Boot
// #############################################################

init();

async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
    const raw = await res.json();
    questions = normalizeArray(raw);
    if (!questions.length) throw new Error('No questions after normalization');

    order = shuffle([...Array(questions.length).keys()]);
    startQuiz();
  } catch (e) {
    console.error(e);
    questionTextElement.textContent = 'Konnte die Übungen nicht laden.';
  }
}

// #############################################################
// Engine (your original logic, adapted to dynamic data)
// #############################################################

function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  scoreElement.innerText = `Punkte: ${score}`;
  highScoreElement.innerText = `Highscore: ${localStorage.getItem(HIGH_SCORE_KEY) || 0}`;
  showQuestion();
}

function showQuestion() {
  resetState();

  const q = questions[order[currentQuestionIndex]];
  questionTextElement.innerText = q.question;

  if (q.type === 'multiple-choice') {
    q.options.forEach(option => {
      const button = document.createElement('button');
      button.innerText = option;
      button.addEventListener('click', () => selectMultipleChoiceAnswer(option, q.answer));
      optionsContainer.appendChild(button);
    });
  } else if (q.type === 'fill-in-the-blank') {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'fill-in-blank-input';

    const submitButton = document.createElement('button');
    submitButton.id = 'submit-answer';
    submitButton.innerText = 'Antwort prüfen';
    submitButton.style.marginTop = '10px';

    optionsContainer.appendChild(input);
    optionsContainer.appendChild(submitButton);

    submitButton.addEventListener('click', () => {
      selectFillInBlankAnswer(input.value, q.answer);
    });
  }
}

function resetState() {
  nextButton.style.display = 'none';
  feedbackElement.innerText = '';
  feedbackElement.style.color = '';
  explanationElement.style.display = 'none';
  explanationElement.innerText = '';
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

  const q = questions[order[currentQuestionIndex]];

  if (selectedOption === correctAnswer) {
    score++;
    scoreElement.innerText = `Punkte: ${score}`;
    feedbackElement.innerText = 'Perfekt!';
    feedbackElement.style.color = 'green';
  } else {
    feedbackElement.innerText = `Falsch. Richtig ist: ${correctAnswer}`;
    feedbackElement.style.color = 'red';
  }

  if (q.explanation) {
    explanationElement.innerText = q.explanation;
    explanationElement.style.display = 'block';
  }

  showNextButton();
}

function selectFillInBlankAnswer(userAnswer, correctAnswer) {
  const inputField = document.getElementById('fill-in-blank-input');
  const submitBtn = document.getElementById('submit-answer');
  if (inputField) inputField.disabled = true;
  if (submitBtn) submitBtn.disabled = true;

  const q = questions[order[currentQuestionIndex]];

  if (userAnswer.trim().toLowerCase() === String(correctAnswer).toLowerCase()) {
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

  if (q.explanation) {
    explanationElement.innerText = q.explanation;
    explanationElement.style.display = 'block';
  }

  showNextButton();
}

function showNextButton() {
  if (currentQuestionIndex + 1 < order.length) {
    nextButton.style.display = 'block';
  } else {
    questionTextElement.innerText = 'Fantastisch! Du hast alle Übungen abgeschlossen!';
    nextButton.style.display = 'none';

    const currentHighScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    if (score > currentHighScore) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      highScoreElement.innerText = `Highscore: ${score}`;
    }
  }
}

nextButton.addEventListener('click', () => {
  currentQuestionIndex++;
  showQuestion();
});
