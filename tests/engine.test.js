import test from 'node:test';
import assert from 'node:assert/strict';
import {films} from '../js/films.js';
import {questions} from '../js/questions.js';
import {baseScore, recommend, weights} from '../js/engine.js';

test('curated database contains 16 unique, complete real-film records', () => {
  assert.equal(films.length,16);
  assert.equal(new Set(films.map(f=>f.id)).size,16);
  for(const f of films) {
    for(const key of ['title','zh','region','style','summary','color','motif']) assert.ok(f[key],`${f.id}: ${key}`);
    assert.ok(f.year>=1900 && f.year<=2026);
    assert.equal(f.facets.length,3);
    f.facets.forEach(facet=>{assert.ok([0,1,2].includes(facet.value));assert.ok(facet.reason.length>10);});
  }
  assert.equal(films.find(f=>f.id==='kill-bill').title,'Kill Bill: Vol. 1');
  assert.equal(films.find(f=>f.id==='truman').year,1998);
});
test('weights contribute exactly 4 / 3 / 3 with no hidden ratings', () => {
  assert.deepEqual(weights,[4,3,3]);
  const film=films[0];
  const a=film.facets.map(f=>f.value);
  assert.equal(baseScore(film,a),10);
  for(let i=0;i<3;i++) {const changed=[...a];changed[i]=(a[i]+1)%3;assert.equal(baseScore(film,changed),10-weights[i]);}
});
for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++) {
  const answers=[a,b,c];
  test(`combination ${answers.join('')}: three unique deterministic recommendations and truthful explanations`, () => {
    const actual=recommend(answers);
    assert.equal(actual.length,3);
    assert.equal(new Set(actual.map(r=>r.film.id)).size,3);
    assert.deepEqual(actual,recommend([...answers]));
    assert.deepEqual(answers,[a,b,c]);
    assert.equal(actual[0].score,Math.max(...films.map(f=>baseScore(f,answers))));
    for(const r of actual) {
      assert.ok(films.includes(r.film));
      assert.ok(r.reasons.length>0);
      assert.equal(r.score,baseScore(r.film,answers));
      assert.equal(r.reasons.length,r.film.facets.filter((f,i)=>f.value===answers[i]).length);
      for(const reason of r.reasons) {
        assert.equal(r.film.facets[reason.dimension].value,answers[reason.dimension]);
        assert.equal(reason.choice,questions[reason.dimension].choices[answers[reason.dimension]].short);
        assert.equal(reason.reason,r.film.facets[reason.dimension].reason);
      }
    }
    // A sub-point diversity adjustment must never outrank a higher base match.
    const selected=[];
    for(const pick of actual) {
      const eligible=films.filter(f=>!selected.includes(f.id));
      assert.equal(pick.score,Math.max(...eligible.map(f=>baseScore(f,answers))));
      selected.push(pick.film.id);
    }
  });
}
test('invalid, incomplete and sparse answers fail explicitly', () => {
  for(const input of [undefined,null,[],[0,1],[0,1,2,0],[-1,0,0],[0,3,0],[0,'1',0],[0,NaN,0],new Array(3)]) assert.throws(()=>recommend(input),TypeError);
});
test('diversity resolves ties and catalog spans regions, styles and decades', () => {
  assert.ok(new Set(films.map(f=>f.region)).size>=5);
  assert.ok(new Set(films.map(f=>f.style)).size>=8);
  assert.ok(new Set(films.map(f=>Math.floor(f.year/10))).size>=4);
  assert.ok(new Set(recommend([1,1,1]).map(r=>r.film.region)).size>=2);
});
