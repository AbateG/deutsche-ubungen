// wortschatz.js
// Run as a module: <script type="module" src="wortschatz.js"></script>

let buildNounExercisesRef = null;

// Try to import nouns.js; fallback to internal builder if unavailable
async function loadNounBuilder() {
  try {
    const mod = await import('../data/wortschatz/nouns.js');
    if (typeof mod.buildNounExercises === 'function') {
      buildNounExercisesRef = mod.buildNounExercises;
      console.log('✅ nouns.js loaded');
      return;
    }
  } catch (e) {
    console.warn('⚠️ nouns.js not found or failed to load. Using fallback builder.', e);
  }
  buildNounExercisesRef = fallbackBuildNounExercises;
  console.log('✅ Using fallback noun builder');
}

// Fallback builder that supports varied schemas
function fallbackBuildNounExercises(entryRaw) {
  const entry = normalizeNounEntry(entryRaw);
  const out = [];
  if (!entry.lemma) return out;

  // Article MCQ
  if (entry.article) {
    out.push({
      type: 'mcq',
      question: `Welcher Artikel passt zu "${entry.lemma}"?`,
      options: shuffleCopy(['der', 'die', 'das']),
      answer: entry.article,
      explain: `${entry.article} ${entry.lemma}`
    });
  }

  // Plural type-in
  if (entry.plural) {
    out.push({
      type: 'type-in',
      question: `Was ist der Plural von "${entry.lemma}"?`,
      answer: entry.plural,
      validator: (input) => normalizeStr(input) === normalizeStr(entry.plural),
      explain: `${entry.lemma} → ${entry.plural}`
    });
  }
  return out;
}

// Normalize noun fields from different shapes
function normalizeNounEntry(e = {}) {
  const lemma = e.lemma || e.word || e.term || '';
  // article might be provided directly, or infer from gender variants
  let article = (e.article || '').toLowerCase();
  let gender = (e.gender || e.genus || e.g || '').toLowerCase();

  // If gender is shorthand, map to article
  const genderToArticle = {
    m: 'der', mas: 'der', maskulin: 'der', männlich: 'der', masculine: 'der',
    f: 'die', fem: "die", feminin: 'die', weiblich: 'die', feminine: 'die',
    n: 'das', neu: "das", neuter: 'das', neutral: 'das', sächlich: 'das'
  };
  if (!article) {
    // sometimes gender is like 'm', 'f', 'n' or full
    article = genderToArticle[gender] || '';
  }
  // If gender is actually an article
  if (!article && ['der', 'die', 'das'].includes(gender)) {
    article = gender;
  }
  // Normalize gender from article if still missing
  if (!gender && ['der', 'die', 'das'].includes(article)) {
    gender = article === 'der' ? 'm' : article === 'die' ? 'f' : 'n';
  }

  // plural field variants
  const plural = e.plural || e.pl || e.plur || '';

  return { ...e, lemma, article, gender, plural };
}

// Simple string normalizer
function normalizeStr(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .trim();
}

// State
let vocabularyData = [];
let questions = [];
let currentQuestionIndex = 0;
let score = 0;

const questionTextElement = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-button');
const feedbackElement = document.getElementById('feedback');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const explanationElement = document.getElementById('explanation');
const progressElement = document.getElementById('progress');
const quizContainer = document.getElementById('quiz-container');

const HIGH_SCORE_KEY = 'deutschMeisterHighScore_Vocab';
const THEME_KEY = 'dm_theme';

// Restart button
const restartButton = document.createElement('button');
restartButton.id = 'restart-button';
restartButton.textContent = 'Nochmal spielen';
restartButton.style.display = 'none';
restartButton.addEventListener('click', () => startQuiz());
quizContainer.appendChild(restartButton);

// Theme toggle
const themeToggleBtn = document.getElementById('theme-toggle');
initTheme();

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.body.classList.toggle('dark', saved === 'dark');
  updateThemeButton();
  themeToggleBtn?.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    updateThemeButton();
  });
}

function updateThemeButton() {
  const isDark = document.body.classList.contains('dark');
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
    themeToggleBtn.title = isDark ? 'Helles Theme' : 'Dunkles Theme';
  }
}

// Boot
init();

async function init() {
  await loadNounBuilder();
  await loadData();
  buildQuestions();
  startQuiz();
}

async function loadData() {
  try {
    const res = await fetch('data/wortschatz/a1.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Keep all entries with a lemma; we’ll decide exercise type later
    vocabularyData = (data || []).filter(e => e && (e.lemma || e.word || e.term));
    console.log('📦 Vocab entries loaded:', vocabularyData.length);
  } catch (err) {
    questionTextElement.innerText = 'Daten konnten nicht geladen werden.';
    feedbackElement.innerText = `Fehler: ${err.message}`;
    feedbackElement.style.color = 'red';
  }
}

// Build questions
function buildQuestions() {
  const translationQs = vocabularyData
    .filter(e => Array.isArray(e.translations) && e.translations[0])
    .map(entry => {
      const answer = entry.translations[0];
      const distractors = getDistractors(answer, 2);
      const options = shuffleCopy([answer, ...distractors]);
      return {
        type: 'mcq',
        question: `Was bedeutet "${entry.lemma || entry.word || entry.term}"?`,
        options,
        answer,
        lemma: entry.lemma || entry.word || entry.term,
        example: entry.examples?.[0],
        explain: `Die Bedeutung von "${entry.lemma || entry.word || entry.term}" ist "${answer}".`
      };
    });

  // Noun exercises (accepts varied pos values and relies on normalization)
  const nounCandidates = vocabularyData.filter(e => {
    const pos = (e.pos || e.partOfSpeech || '').toString().toLowerCase();
    return pos.includes('noun') || pos === 'n' || ['der','die','das'].includes((e.article||'').toLowerCase()) || (e.gender || e.genus);
  });

  const nounExercises = nounCandidates
  .flatMap(entry => buildNounExercisesRef ? buildNounExercisesRef(entry) : [])
  .filter(Boolean)
  .map((ex, i) => {
    const questionText = ex.prompt ?? ex.question ?? `[🛑 Fehlende Frage ${i}]`;
    return {
      type: ex.type,
      question: questionText,
      options: ex.choices || [],
      answer: ex.answer,
      validator: ex.validator,
      explain: ex.explain,
      lemma: ex.lemma
    };
  });

  questions = shuffleCopy([...translationQs, ...nounExercises]);

  console.log(`🧠 Translation questions: ${translationQs.length}`);
  console.log(`📘 Noun exercises: ${nounExercises.length}`);
  console.log(`🧩 Total questions: ${questions.length}`);
}

// Quiz flow
function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  scoreElement.innerText = `Punkte: ${score}`;
  highScoreElement.innerText = `Highscore: ${localStorage.getItem(HIGH_SCORE_KEY) || 0}`;
  restartButton.style.display = 'none';
  nextButton.style.display = 'none';
  feedbackElement.innerText = '';
  explanationElement.innerText = '';
  explanationElement.style.display = 'none';

  if (questions.length === 0) {
    questionTextElement.innerText = '❌ Keine Übungen verfügbar.';
    return;
  }

  showQuestion();
}

function showQuestion() {
  resetState();

  const q = questions[currentQuestionIndex];
  if (!q) {
    questionTextElement.innerText = 'Keine Frage verfügbar.';
    return;
  }

  questionTextElement.innerText = q.question;
  updateProgress();

  if (q.type === 'mcq') {
    q.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.innerText = option;
      btn.addEventListener('click', () => handleAnswer(option, q));
      optionsContainer.appendChild(btn);
    });
  } else if (q.type === 'type-in') {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Antwort eingeben...';
    input.autocomplete = 'off';

    const submit = document.createElement('button');
    submit.textContent = 'Antwort überprüfen';
    submit.addEventListener('click', () => handleAnswer(input.value.trim(), q));

    optionsContainer.appendChild(input);
    optionsContainer.appendChild(submit);
  }
}

function handleAnswer(selected, q) {
  const correct =
    (typeof q.validator === 'function' ? q.validator(selected) : null) ??
    (String(selected).toLowerCase() === String(q.answer ?? '').toLowerCase());

  if (correct) {
    score++;
    scoreElement.innerText = `Punkte: ${score}`;
    feedbackElement.innerText = 'Super! 🎉';
    feedbackElement.style.color = 'green';
  } else {
    feedbackElement.innerText = `Falsch. Richtig ist: ${q.answer}`;
    feedbackElement.style.color = 'red';
  }

  if (q.explain) {
    explanationElement.innerText = q.explain;
    explanationElement.style.display = 'block';
  }

  const lastQuestion = currentQuestionIndex >= questions.length - 1;
  nextButton.style.display = lastQuestion ? 'none' : 'block';
  restartButton.style.display = lastQuestion ? 'block' : 'none';

  if (lastQuestion) {
    updateHighScoreIfNeeded();
    feedbackElement.innerText += ' Du hast alle Übungen abgeschlossen!';
  }

  markAndDisableOptions(q, correct, selected);
}

function markAndDisableOptions(q, correct, selected) {
  // For MCQ: mark correct/incorrect
  Array.from(optionsContainer.children).forEach(child => {
    if (child.tagName === 'BUTTON') {
      child.disabled = true;
      if (q.type === 'mcq') {
        if (child.innerText === q.answer) child.classList.add('correct');
        if (child.innerText === selected && !correct) child.classList.add('incorrect');
      }
    }
  });
  // For type-in: apply class to input
  if (q.type === 'type-in') {
    const input = optionsContainer.querySelector('input[type="text"]');
    if (input) input.classList.add(correct ? 'correct' : 'incorrect');
  }
}

function resetState() {
  nextButton.style.display = 'none';
  feedbackElement.innerText = '';
  explanationElement.innerText = '';
  explanationElement.style.display = 'none';
  restartButton.style.display = 'none';
  optionsContainer.innerHTML = '';
}

nextButton.addEventListener('click', () => {
  currentQuestionIndex++;
  showQuestion();
});

function updateHighScoreIfNeeded() {
  const currentHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
  if (score > currentHigh) {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
    highScoreElement.innerText = `Highscore: ${score}`;
  }
}

function updateProgress() {
  progressElement.innerText = `Frage ${currentQuestionIndex + 1} von ${questions.length}`;
}

// Utilities
function getDistractors(correct, count = 2) {
  const pool = vocabularyData
    .map(e => e.translations?.[0])
    .filter(t => t && t !== correct);

  const unique = Array.from(new Set(pool));
  return shuffleCopy(unique).slice(0, Math.min(count, unique.length));
}

function shuffleCopy(arr = []) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
