import test from 'node:test';
import assert from 'node:assert/strict';
import {createFunnel} from '../js/funnel.js';
const store = () => {
  const map = new Map();
  return {getItem: key => map.get(key), setItem: (key,value) => map.set(key,value)};
};

test('three milestones emitted once, preserving WeChat source on rerender/reload', () => {
  const storage=store(); const events=[];
  const emit=(event,data)=>events.push({event,data});
  let record=createFunnel({storage,search:'?utm_source=wechat_moments',emit});
  record('cinema_open');record('cinema_open');record('cinema_start');
  // Reload without UTM before completing still retains the original source.
  record=createFunnel({storage,search:'',emit});
  record('cinema_open');record('cinema_start');record('cinema_complete');
  record('cinema_complete');record('cinema_start');
  assert.deepEqual(events,['cinema_open','cinema_start','cinema_complete'].map(event=>({event,data:{source:'wechat_moments'}})));
});
test('a new tab/session starts a fresh funnel; original attribution does not change', () => {
  const events=[]; const storage=store(); const emit=(event,data)=>events.push({event,data});
  createFunnel({storage,search:'',emit})('cinema_open');
  createFunnel({storage,search:'?utm_source=wechat_moments',emit})('cinema_start');
  createFunnel({storage:store(),search:'?utm_source=wechat_moments',emit})('cinema_open');
  assert.deepEqual(events.map(x=>x.data.source),['direct','direct','wechat_moments']);
});
test('arbitrary query values and unknown events cannot leak private data', () => {
  const events=[];const record=createFunnel({storage:store(),search:'?utm_source=someone@example.com&answer=A&film=private',emit:(event,data)=>events.push({event,data})});
  assert.equal(record('answer_A'),false);record('cinema_open');
  assert.deepEqual(events,[{event:'cinema_open',data:{source:'other'}}]);
});
test('storage and transport failures never break movie flow', () => {
  const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  let count=0;const record=createFunnel({storage,emit:()=>{count++;throw Error('offline');}});
  assert.equal(record('cinema_open'),true);assert.equal(record('cinema_open'),false);assert.equal(count,1);
});
