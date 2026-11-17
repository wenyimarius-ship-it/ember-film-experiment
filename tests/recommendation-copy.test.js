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

test('one-match Inception uses a viewing-value sentence, one unchanged fact and exact count',()=>{
  const candidate=find([0,0,0]);
  assert.equal(candidate.reasons.length,1);
  assert.equal(recommendationSentence(candidate),'它认真对待重新开始的愿望，让争取主动权这件事有了切实的情感分量。');
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
  assert.equal(recommendationSentence(rhythm),'多层结构与散落线索相互扣合，观看的乐趣在于把复杂关系逐步拼清。');
  assert.equal(recommendationSentence(ending),'最后留下的疑问持续邀请不同理解，结局的吸引力就在这份开放之中。');
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
  assert.equal(recommendationSentence(candidate),'它把求生的窘迫转化成小人物的韧性，让争取生活空间的努力格外可亲。');
});

test('missing or unrecognized matching data cannot fall back to an invented recommendation',()=>{
  const candidate=find([0,0,0]);
  for(const value of [null,{}, {...candidate,reasons:[]},{...candidate,film:{...candidate.film,id:'unknown-film'}},{...candidate,reasons:[{...candidate.reasons[0],dimension:3}]},{...candidate,reasons:[{...candidate.reasons[0],reason:'not an actual film fact'}]}]){
    assert.throws(()=>recommendationSentence(value),TypeError);
  }
  assert.throws(()=>matchHeading({dimension:9,choice:'unknown'}),TypeError);
});

test('viewing-value recommendations do not repeat the Spirited Away plot setup',()=>{
  const candidate=find([0,0,0],'spirited-away');
  assert.equal(recommendationSentence(candidate),'它把勇气落在一次次小小的尝试里，让主动权的建立变得可感。');
  assert.deepEqual(candidate.reasons.map(r=>r.dimension),[0,2]);
  assert.deepEqual(candidate.reasons.map(r=>r.reason),[
    '千寻在陌生环境中学习规则，以行动争取回家的机会。',
    '少女在旅程中成长，学会承担与告别。'
  ]);
  assert.equal(matchSummary(candidate),'匹配 2 / 3 个故事偏好；仅解释实际匹配的偏好。');
  for(const answers of [[0,0,1],[1,1,1],[1,0,0]]){
    const actual=find(answers,'spirited-away');
    assert.equal(actual.reasons.length,1);
    assert.doesNotMatch(recommendationSentence(actual),/千寻|少女|神灵|陌生世界|回家/,'recommend the viewing value instead of replaying the synopsis');
  }
  assert.doesNotMatch(recommendationSentence(find([0,0,0])),/梦境|任务|团队/,'Inception response copy also leaves the setup to its synopsis');
  assert.doesNotMatch(recommendationSentence(find([0,0,0],'gold-rush')),/雪地|淘金|流浪汉|前往/,'Gold Rush response copy also leaves the setup to its synopsis');
});
