import {films} from './films.js';
import {questions} from './questions.js';
export const weights = [4, 3, 3];
export function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 3 || !Array.from(answers).every(a => Number.isInteger(a) && a >= 0 && a <= 2)) throw new TypeError('请选择全部三个情境。');
}
export function baseScore(film, answers) {
  validateAnswers(answers);
  return film.facets.reduce((sum, facet, i) => sum + (facet.value === answers[i] ? weights[i] : 0), 0);
}
export function explain(film, answers) {
  validateAnswers(answers);
  return film.facets.flatMap((facet, i) => facet.value === answers[i] ? [{dimension:i, choice:questions[i].choices[answers[i]].short, reason:facet.reason}] : []);
}
// Greedy, deterministic diversity adjustment. Maximum penalty 0.9 < one dimension's weight.
export function recommend(answers) {
  validateAnswers(answers);
  const chosen = [];
  const remaining = films.map(film => ({film, score:baseScore(film, answers)}));
  while (chosen.length < 3) {
    const adjusted = candidate => candidate.score - (chosen.length ? ['style','region','decade'].reduce((penalty,key) => {
      const value = f => key === 'decade' ? Math.floor(f.year / 10) : f[key];
      return penalty + (chosen.some(c => value(c.film) === value(candidate.film)) ? 0.3 : 0);
    }, 0) : 0);
    remaining.sort((a,b) => adjusted(b) - adjusted(a) || b.score - a.score || a.film.id.localeCompare(b.film.id, 'en'));
    const selected = remaining.shift();
    chosen.push({...selected, reasons:explain(selected.film, answers)});
  }
  return chosen;
}
