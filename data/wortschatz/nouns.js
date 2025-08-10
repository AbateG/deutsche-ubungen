export function buildNounExercises(entry) {
  const items = [];

  // ⛳ Article selection
  if (entry.gender && entry.lemma) {
    const correctArticle = entry.gender === 'maskulin' ? 'der'
                        : entry.gender === 'feminin' ? 'die'
                        : entry.gender === 'neutral' ? 'das' : null;

    if (correctArticle) {
      items.push({
        id: `${entry.id}-article`,
        type: 'mcq',
        prompt: `Was ist der richtige Artikel für "${entry.lemma}"?`,
        choices: shuffle(['der', 'die', 'das']),
        answer: correctArticle,
        explain: `${correctArticle} ${entry.lemma}`,
        tags: ['artikel', entry.gender],
        meta: { pos: 'noun', level: entry.level, tags: entry.tags }
      });
    }
  }

  // 📚 Plural formation
  if (entry.plural) {
    items.push({
      id: `${entry.id}-plural`,
      type: 'type-in',
      prompt: `Was ist der Plural von "${entry.lemma}"?`,
      answer: entry.plural,
      validator: (input) => normalize(input) === normalize(entry.plural),
      explain: `${entry.lemma} → ${entry.plural}`,
      tags: ['plural'],
      meta: { pos: 'noun', level: entry.level, tags: entry.tags }
    });
  }

  return items;
}

// Optional: tolerant matching function
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
}

function shuffle(array) {
  return array.map(a => [Math.random(), a])
              .sort((a, b) => a[0] - b[0])
              .map(a => a[1]);
}
