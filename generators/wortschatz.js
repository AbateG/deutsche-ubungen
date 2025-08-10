import entries from '../data/a1.json';

// Exercise builders (to be implemented step-by-step)
import { buildNounExercises } from './builders/nouns.js';
import { buildVerbExercises } from './builders/verbs.js';
import { buildAdjExercises } from './builders/adjectives.js';

function generateExercises(entries) {
  let allExercises = [];

  entries.forEach(entry => {
    switch (entry.pos) {
      case 'noun':
        allExercises.push(...buildNounExercises(entry));
        break;
      case 'verb':
        allExercises.push(...buildVerbExercises(entry));
        break;
      case 'adj':
        allExercises.push(...buildAdjExercises(entry));
        break;
    }

    // Universal exercise types
    allExercises.push({
      type: 'translation',
      prompt: `What is "${entry.translations[0]}" in German?`,
      answer: entry.lemma
    });

    if (entry.examples?.length) {
      allExercises.push({
        type: 'cloze',
        prompt: entry.examples[0].de.replace(entry.lemma, '___'),
        answer: entry.lemma
      });
    }
  });

  return allExercises;
}

// Export or log for debugging
console.log(JSON.stringify(generateExercises(entries), null, 2));
