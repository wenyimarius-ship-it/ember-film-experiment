import test from 'node:test';
import assert from 'node:assert/strict';
import {createFunnel, createFeedback} from '../js/funnel.js';
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

test('feedback counts a title and swap position once across rerenders and reloads, allowing the next recommendation', () => {
  const storage=store(), events=[];
  const emit=(event,data)=>events.push({event,data});
  let feedback=createFeedback({storage,emit});
  const first={film_id:'whiplash',swap_count:0,rating:'accurate'};
  assert.equal(feedback.record({...first,answers:[0,1,2],recovery_code:'SECRET'}),true);
  assert.equal(feedback.record({...first,rating:'off'}),false);
  feedback=createFeedback({storage,emit});
  assert.equal(feedback.ratingFor(first),'accurate');
  assert.equal(feedback.record(first),false);
  assert.equal(feedback.record({...first,swap_count:1,rating:'partial'}),true);
  assert.equal(feedback.record({...first,film_id:'arrival',rating:'off'}),true);
  assert.deepEqual(events,[first,{...first,swap_count:1,rating:'partial'},{...first,film_id:'arrival',rating:'off'}].map(data=>({event:'cinema_feedback',data})));
  assert.equal(JSON.stringify([...events]).includes('SECRET'),false);
  assert.equal(storage.getItem('cinema.feedback.v1').includes('answers'),false);
  assert.equal(createFeedback({storage:store(),emit}).record(first),true,'a new session may rate again');
});

test('feedback rejects unknown titles, ratings and invalid swap counts without emitting', () => {
  const feedback=createFeedback({storage:store(),emit:()=>assert.fail('invalid feedback emitted')});
  for (const data of [null,{}, {film_id:'private-answer',swap_count:0,rating:'accurate'}, ...[-1,0.5,35,Infinity,'0'].map(swap_count=>({film_id:'whiplash',swap_count,rating:'accurate'})), {film_id:'whiplash',swap_count:0,rating:'email@example.com'}]) {
    assert.equal(feedback.record(data),false);
  }
});

test('feedback stays locked and main flow remains usable when storage or transport fails', async () => {
  for (const emit of [()=>{throw Error('offline');},()=>Promise.reject(Error('offline'))]) {
    const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
    const feedback=createFeedback({storage,emit});
    const first={film_id:'whiplash',swap_count:0,rating:'off'};
    assert.equal(feedback.record(first),true);
    assert.equal(feedback.record(first),false);
    assert.equal(feedback.ratingFor(first),'off');
    assert.equal(feedback.record({...first,swap_count:1}),true);
  }
  await new Promise(resolve=>setImmediate(resolve));
});

test('corrupt persisted feedback does not block valid feedback or reintroduce private properties', () => {
  const storage=store();
  storage.setItem('cinema.feedback.v1',JSON.stringify([null,{film_id:'whiplash',swap_count:0,rating:'accurate',answers:['SECRET']},{film_id:'private',swap_count:0,rating:'off'}]));
  const feedback=createFeedback({storage,emit:()=>{}});
  assert.equal(feedback.ratingFor({film_id:'whiplash',swap_count:0}),'accurate');
  assert.equal(feedback.record({film_id:'arrival',swap_count:1,rating:'partial'}),true);
  assert.equal(storage.getItem('cinema.feedback.v1').includes('SECRET'),false);
  storage.setItem('cinema.feedback.v1','{invalid');
  assert.equal(createFeedback({storage,emit:()=>{}}).record({film_id:'arrival',swap_count:0,rating:'off'}),true);
});
