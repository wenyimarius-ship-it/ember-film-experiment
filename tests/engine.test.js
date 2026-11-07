import test from 'node:test';
import assert from 'node:assert/strict';
import {films} from '../js/films.js';
import {questions} from '../js/questions.js';
import {baseScore, recommend, weights} from '../js/engine.js';

test('curated database contains 35 unique, complete real-film records', () => {
  assert.equal(films.length,35);
  assert.equal(new Set(films.map(f=>f.id)).size,35);
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

// The historical 16-film snapshot remains as history; active catalog expectations
// come from the public, sanitized 35-film approval/coverage fixture.
const {readFile} = await import('node:fs/promises');
const {createHash} = await import('node:crypto');
const {candidates, headlineReason} = await import('../js/engine.js');
const fixture=JSON.parse(await readFile(new URL('./fixtures/curated-library.json',import.meta.url),'utf8'));
test('exactly the 35 intended versions and site tags; no private website fields',()=>{
  assert.equal(fixture.films.length,35);
  assert.deepEqual(films.map(f=>({id:f.id,zh:f.zh,year:f.year,site_code:f.facets.map(x=>'ABC'[x.value]).join('')})),fixture.films.map(({final_code,...f})=>f));
  const allowed=['id','title','zh','year','region','style','color','motif','summary','facets'].sort();
  for(const f of films)assert.deepEqual(Object.keys(f).sort(),allowed);
  assert.equal(films.find(f=>f.id==='arrival').facets.map(f=>'ABC'[f.value]).join(''),'BCB');
  assert.equal(fixture.films.find(f=>f.id==='arrival').final_code,'BCC');
});
test('questions and engine are byte-for-byte unchanged from reviewed first-visit version',async()=>{
  const expected={questions:'785b2f30e1ca1640e97ee6d607b5f486f68cfd1298add681d0058f86777ef9aa',engine:'b276e5720810dc8d279cb63b2b89239059719b669b388727d8d4ed0ced28baf8'};
  for(const [name,hash] of Object.entries(expected))assert.equal(createHash('sha256').update(await readFile(new URL(`../js/${name}.js`,import.meta.url))).digest('hex'),hash);
});
for(const row of fixture.coverage) {
  test(`final ${row.final_code} / site ${row.site_code}: 35 scores, approved counts, finite grounded swap order`,()=>{
    const answers=[...row.site_code].map(c=>'ABC'.indexOf(c));
    const distribution={'10':0,'7':0,'6':0};
    for(const f of films){
      const original=fixture.films.find(x=>x.id===f.id);
      const expected=[...row.final_code].reduce((sum,c,i)=>sum+(c===original.final_code[i]?weights[i]:0),0);
      assert.equal(baseScore(f,answers),expected,`${f.zh} score`);
      if(String(expected) in distribution)distribution[String(expected)]++;
    }
    assert.deepEqual(distribution,row.counts);
    const pool=candidates(answers);
    assert.deepEqual(pool,candidates([...answers]));
    assert.deepEqual(pool.slice(0,3),recommend(answers));
    assert.equal(new Set(pool.map(c=>c.film.id)).size,pool.length);
    assert.equal(pool.length,films.filter(f=>baseScore(f,answers)>0).length);
    assert.ok(pool.length<=35);
    for(const c of pool){
      assert.ok(c.score>0 && c.reasons.length>0);
      assert.equal(c.reasons.length,c.film.facets.filter((f,i)=>f.value===answers[i]).length);
      for(const r of c.reasons){assert.equal(c.film.facets[r.dimension].value,answers[r.dimension]);assert.equal(r.reason,c.film.facets[r.dimension].reason);assert.equal(r.choice,questions[r.dimension].choices[answers[r.dimension]].short);}
      assert.ok(headlineReason(c).includes(c.reasons[0].reason));
    }
  });
}
