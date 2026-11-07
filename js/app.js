import {questions} from './questions.js';
import {recommend} from './engine.js';
const main = document.querySelector('main');
const answers = [null, null, null];
let scene = -1;
let result = [];
const letters = ['A', 'B', 'C'];
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function focusHeading() { main.querySelector('h1').focus({preventScroll:true}); window.scrollTo({top:0, behavior:'instant'}); }
function render() {
  if (scene === -1) renderIntro();
  else if (scene < 3) renderQuestion();
  else renderResults();
  focusHeading();
}
function renderIntro() {
  main.innerHTML = `<section class="intro enter"><div class="intro-copy"><p class="eyebrow"><span class="live-dot"></span> EMBER LAB PRESENTS / VOL. 001</p><h1 tabindex="-1">What would<br>you <em>watch?</em></h1><p class="intro-cn">如果今晚，只为你放一场电影。</p><p class="muted intro-description">三个情境，三次选择。<br>从 16 部电影中，找到此刻想进入的故事。<br>没有标准答案，也不是人格测评。</p><button class="primary" data-action="begin">进入放映室 <span aria-hidden="true">↗</span></button><p class="fine">约 1 分钟 <span>·</span> 无需登录 <span>·</span> 选择只留在此页面</p></div><div class="screen-art" aria-hidden="true"><div class="art-top">CINEMA EXPERIMENT <span>16 FILMS / 3 CHOICES</span></div><div class="frame-art"><div class="art-orbit"></div><div class="art-slit"></div><span class="art-caption">EVERY CHOICE<br>OPENS A DIFFERENT<br><em>WORLD.</em></span><span class="frame-number">01 — 03</span></div><div class="art-bottom"><span>YOUR SEAT IS WAITING.</span><span>▶</span></div></div></section><div class="intro-strip"><span>不是「你是谁」</span><span>而是「此刻，你想看什么」</span><span class="strip-star" aria-hidden="true">✳</span></div>`;
}
function renderQuestion() {
  const q = questions[scene];
  main.innerHTML = `<section class="question enter"><div class="scene-header"><p class="eyebrow">SCENE 0${scene+1} <span class="muted">/ 03</span></p><div class="progress" role="progressbar" aria-label="情境进度" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${scene+1}" aria-valuetext="第 ${scene+1} 题，共 3 题">${questions.map((_,i)=>`<span class="${i <= scene ? 'filled' : ''}"></span>`).join('')}</div></div><p class="scene-label">${q.label}</p><h1 tabindex="-1">${q.title}<br><em>${q.tail}</em></h1><p class="muted prompt">跟随直觉，选一个此刻最吸引你的方向。</p><div class="choices" role="group" aria-label="情境选项">${q.choices.map((choice,i)=>`<button class="choice ${answers[scene]===i?'selected':''}" data-choice="${i}" aria-pressed="${answers[scene]===i}"><span class="letter">${letters[i]}</span><span>${choice.label}</span><span class="choice-mark" aria-hidden="true">${answers[scene]===i?'✓':'↗'}</span></button>`).join('')}</div><div class="question-controls"><button class="text-button" data-action="back">← ${scene===0?'返回开场':'上一题'}</button><span class="keyboard-note">按 A / B / C 或 1 / 2 / 3 选择 · Enter 继续</span><button class="primary" data-action="next" ${answers[scene]===null?'disabled':''}>${scene===2?'开始放映':'下一幕'} <span aria-hidden="true">→</span></button></div></section>`;
}
function renderResults() {
  result = recommend(answers);
  main.innerHTML = `<section class="results enter"><div class="result-heading"><div><p class="eyebrow"><span class="live-dot"></span> YOUR PRIVATE SCREENING</p><h1 tabindex="-1">今晚的片单，<em>为此刻的你。</em></h1></div><span class="result-count">03<span>FILMS, FOR YOU</span></span></div><p class="muted result-description">由你的故事偏好出发，选出三个入口。不是评分榜，也不定义你。</p><div class="answer-summary" aria-label="你的选择">${questions.map((q,i)=>`<button data-edit="${i}" aria-label="修改第 ${i+1} 题：${q.choices[answers[i]].short}"><span>0${i+1}</span> ${q.choices[answers[i]].short} <span aria-hidden="true">↗</span></button>`).join('')}</div><div class="film-grid">${result.map(({film:f,reasons},i)=>`<article class="film-card" style="--film-color:${f.color}"><div class="film-art ${f.motif}" aria-hidden="true"><div class="film-art-top">EMBER SELECTS <span>0${i+1}</span></div><div class="film-symbol"></div><span class="poster-title">${escape(f.title)}</span><span class="poster-year">${f.year} / ${escape(f.style)}</span></div><div class="film-info"><p class="film-meta">${f.year} <span>·</span> ${escape(f.region)} <span>·</span> ${escape(f.style)}</p><h2>${escape(f.title)}</h2><p class="film-zh">${escape(f.zh)}</p><p class="film-summary">${escape(f.summary)}</p><div class="why"><h3>WHY THIS FILM / 为什么是它</h3>${reasons.map(r=>`<p><span class="match-tag">${escape(r.choice)}</span>${escape(r.reason)}</p>`).join('')}</div><p class="fit-note">回应了你 ${reasons.length} / 3 个选择${reasons.length<3?' · 也带来一点不同的观看方向':''}</p></div></article>`).join('')}</div><p class="editorial-note">本片单采用本地编辑标签，按 4 / 3 / 3 权重匹配，并适度考虑风格、地区与年代。相同选择会得到相同结果。部分影片包含暴力或沉重主题，请按自身观影需求选择。</p><div class="result-actions"><button class="primary" data-action="copy">复制这份片单 <span aria-hidden="true">↗</span></button><button class="secondary" data-edit="0">修改选择</button><button class="text-button" data-action="restart">重新体验 ↻</button></div><p id="copy-status" class="copy-status" role="status" aria-live="polite"></p><div id="copy-fallback" hidden><label for="copy-text">未能访问剪贴板，请选中以下内容手动复制：</label><textarea id="copy-text" readonly rows="8"></textarea></div></section>`;
}
function copyText() {
  return ['Cinema Experiment — What Would You Watch?', ...questions.map((q,i)=>`${i+1}. ${q.choices[answers[i]].label}`), '', ...result.map(({film,reasons},i)=>`${i+1}. ${film.title} / ${film.zh} (${film.year})\n${reasons.map(r=>`${r.choice}：${r.reason}`).join('\n')}`), '', 'Ember Lab · https://lab.mariustang.com/'].join('\n');
}
async function copyResults(button) {
  button.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(copyText());
    document.querySelector('#copy-status').textContent = '已复制片单，可以分享给朋友了。';
  } catch {
    document.querySelector('#copy-status').textContent = '复制失败：浏览器未允许访问剪贴板。你仍可手动复制下方片单。';
    const fallback = document.querySelector('#copy-fallback');
    fallback.hidden = false;
    const field = fallback.querySelector('textarea');
    field.value = copyText(); field.focus(); field.select();
  } finally { button.disabled = false; }
}
function select(choice) {
  answers[scene] = choice;
  const buttons = main.querySelectorAll('[data-choice]');
  buttons.forEach((button,i)=>{
    button.classList.toggle('selected', i===choice); button.setAttribute('aria-pressed', i===choice);
    button.querySelector('.choice-mark').textContent = i===choice?'✓':'↗';
  });
  main.querySelector('[data-action="next"]').disabled = false;
  buttons[choice].focus();
}
main.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.hasAttribute('data-choice')) {select(Number(button.dataset.choice)); return;}
  if (button.hasAttribute('data-edit')) {scene=Number(button.dataset.edit);render();return;}
  switch(button.dataset.action) {
    case 'begin': scene=0;break;
    case 'next': if(answers[scene]===null)return;scene++;break;
    case 'back': scene--;break;
    case 'restart': answers.fill(null);scene=-1;break;
    case 'copy': copyResults(button);return;
    default:return;
  }
  render();
});
document.addEventListener('keydown', event=>{
  if(scene<0 || scene>2 || event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select'))return;
  const key=event.key.toLowerCase();
  const choice={'a':0,'b':1,'c':2,'1':0,'2':1,'3':2}[key];
  if(choice!==undefined){event.preventDefault();select(choice);}
  else if(key==='enter' && (!event.target.closest('button') || event.target.closest('[data-choice]')) && answers[scene]!==null){event.preventDefault();scene++;render();}
  else if(key==='escape'){event.preventDefault();scene--;render();}
  else if(key==='arrowright' || key==='arrowleft'){
    event.preventDefault();select(((answers[scene]??(key==='arrowright'?-1:0))+(key==='arrowright'?1:2))%3);
  }
});
render();
