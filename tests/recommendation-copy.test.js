import test from 'node:test';
import assert from 'node:assert/strict';
import {films} from '../js/films.js';
import {candidates,headlineReason} from '../js/engine.js';
import {recommendationSentence,matchHeading,matchSummary} from '../js/recommendation-copy.js';

function find(answers,id='inception') {
  const candidate=candidates(answers).find(c=>c.film.id===id);
  assert.ok(candidate,`${id} must be an actual positive candidate`);
  return candidate;
}

test('all 27 pools have original, non-repeating editorial copy for every actual primary match',()=>{
  const covered=new Map();
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++){
    const pool=candidates([a,b,c]);
    const original=JSON.stringify(pool);
    for(const candidate of pool){
      const line=recommendationSentence(candidate);
      assert.ok(line.length>=15,`${candidate.film.id}: substantial viewing sentence`);
      assert.doesNotMatch(line,/你选了|你(?:现在|此刻|今天|今晚)(?:很|正|需要|心情)/);
      assert.notEqual(line,headlineReason(candidate));
      assert.equal(line.includes(candidate.film.summary),false,'do not copy the synopsis');
      for(const facet of candidate.film.facets)assert.equal(line.includes(facet.reason),false,'do not repeat evidence, including other dimensions');
      const key=`${candidate.film.id}:${candidate.reasons[0].dimension}`;
      if(covered.has(key))assert.equal(line,covered.get(key));
      covered.set(key,line);
    }
    assert.equal(JSON.stringify(pool),original,'display helpers must not mutate films, scores, matching facts or candidate order');
  }
  assert.equal(covered.size,films.length*3,'cover every film and all three possible primary dimensions');
  assert.equal(new Set(covered.values()).size,covered.size,'each film/dimension has its own maintained sentence');
});

test('one-match Inception uses the approved response sentence, one unchanged fact and exact count',()=>{
  const candidate=find([0,0,0]);
  assert.equal(candidate.reasons.length,1);
  assert.equal(recommendationSentence(candidate),'一场深入梦境的任务，也是人物重新争取生活主动权的机会。');
  assert.deepEqual(candidate.reasons,[{dimension:0,choice:'重建秩序',reason:'人物试图通过任务重新争取自己的生活。'}]);
  assert.equal(matchHeading(candidate.reasons[0]),'面对失败 → 重建秩序');
  assert.equal(matchSummary(candidate),'匹配 1 / 3 个故事偏好；仅解释实际匹配的偏好。');
  assert.doesNotMatch(recommendationSentence(candidate),/节奏|结尾|结局|悬念/);
});

test('copy selection follows only the first actual match, including rhythm-only and ending-only cases',()=>{
  const response=find([0,0,0]);
  const rhythm=find([1,2,0]);
  const ending=find([1,0,1]);
  assert.deepEqual([response,rhythm,ending].map(c=>c.reasons.map(r=>r.dimension)),[[0],[1],[2]]);
  assert.equal(recommendationSentence(rhythm),'跟着梦境一层层深入，让散落的线索拼出这场任务的结构。');
  assert.equal(recommendationSentence(ending),'不妨把最后的疑问留在心里，这场梦境任务并不替你封好所有答案。');
  const all=find([0,2,1]);
  assert.equal(all.reasons.length,3);
  assert.equal(recommendationSentence(all),recommendationSentence(response),'additional matches do not select an ungrounded different dimension');
  assert.equal(recommendationSentence({...all,reasons:[all.reasons[1],all.reasons[0],all.reasons[2]]}),recommendationSentence(rhythm),'use the supplied first match, without adding display-side ranking');
  assert.equal(matchSummary(all),'匹配 3 / 3 个故事偏好；仅解释实际匹配的偏好。');
});

test('display labels preserve the original preference and exact matching facts',()=>{
  const candidate=find([0,0,0],'gold-rush');
  assert.deepEqual(candidate.reasons.map(matchHeading),['面对失败 → 重建秩序','故事节奏 → 强烈节奏','故事结局 → 人物改变']);
  for(const reason of candidate.reasons)assert.equal(reason.reason,candidate.film.facets[reason.dimension].reason);
  assert.equal(recommendationSentence(candidate),'跟随雪地里的小人物，看他怎样在窘境中为生活再找一个机会。');
});

test('missing or unrecognized matching data cannot fall back to an invented recommendation',()=>{
  const candidate=find([0,0,0]);
  for(const value of [null,{}, {...candidate,reasons:[]},{...candidate,film:{...candidate.film,id:'unknown-film'}},{...candidate,reasons:[{...candidate.reasons[0],dimension:3}]},{...candidate,reasons:[{...candidate.reasons[0],reason:'not an actual film fact'}]}]){
    assert.throws(()=>recommendationSentence(value),TypeError);
  }
  assert.throws(()=>matchHeading({dimension:9,choice:'unknown'}),TypeError);
});
