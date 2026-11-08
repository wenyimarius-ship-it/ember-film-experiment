import {mountCloudVault} from './cloud-vault.js';
import {analyticsConfig} from './analytics-config.js';
import {trackFunnel} from './analytics.js';
import {questions} from './questions.js';
import {candidates, headlineReason} from './engine.js';

const main = document.querySelector('main');
const answers = [null, null, null];
const letters = ['A', 'B', 'C'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let scene = -1;
let result = [];
let resultIndex = 0;
let confirmed = false;
let exhausted = false;
let advancing = false;
let transitionTimer;
let viewVersion = 0;
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function render({focus = true} = {}) {
  clearTimeout(transitionTimer);
  advancing = false;
  viewVersion++;
  if (scene === -1) { renderIntro(); trackFunnel('open'); }
  else if (scene < 3) renderQuestion();
  else { renderResults(); trackFunnel('complete'); }
  if (focus) {
    main.querySelector('h1').focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'instant'});
  }
}

function renderIntro() {
  main.innerHTML = `<section class="intro enter"><div class="intro-copy">
    <p class="eyebrow"><span class="live-dot"></span> CINEMA EXPERIMENT</p>
    <h1 tabindex="-1">今晚<em>想看什么？</em></h1>
    <p class="intro-cn">选三次，找到一部适合此刻的电影。</p>
    <button class="primary" data-action="begin">开始选 <span aria-hidden="true">↗</span></button>
    <p class="fine">约 1 分钟</p>
  </div><div class="screen-art" aria-hidden="true"><div class="art-top">CINEMA EXPERIMENT <span>A FILM FOR TONIGHT</span></div>
    <div class="frame-art"><div class="art-orbit"></div><div class="art-slit"></div>
      <span class="art-caption">WHAT WOULD<br>YOU <em>WATCH?</em></span><span class="frame-number">01 — 03</span>
    </div><div class="art-bottom"><span>YOUR SEAT IS WAITING.</span><span>▶</span></div>
  </div></section>`;
}

function renderQuestion() {
  const q = questions[scene];
  main.innerHTML = `<section class="question enter">
    <div class="scene-header"><p class="eyebrow">${scene + 1} / 3 <span class="muted">次选择</span></p>
      <div class="progress" role="progressbar" aria-label="情境进度" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${scene + 1}" aria-valuetext="第 ${scene + 1} 题，共 3 题">${questions.map((_, i) => `<span class="${i <= scene ? 'filled' : ''}"></span>`).join('')}</div>
    </div><p class="scene-label">${q.label}</p>
    <h1 tabindex="-1">${q.title}<br><em>${q.tail}</em></h1>
    <p class="muted prompt">此刻更想看哪一种？选一个，继续。</p>
    <div class="choices" role="group" aria-label="情境选项">${q.choices.map((choice, i) => `<button class="choice ${answers[scene] === i ? 'selected' : ''}" data-choice="${i}" aria-pressed="${answers[scene] === i}"><span class="letter">${letters[i]}</span><span>${choice.label}</span><span class="choice-mark" aria-hidden="true">${answers[scene] === i ? '✓' : '↗'}</span></button>`).join('')}</div>
    <div class="question-controls"><button class="text-button" data-action="back">← ${scene === 0 ? '返回开场' : '上一题'}</button><span class="keyboard-note">A / B / C 直接选择 · 方向键浏览 · Enter 确认</span></div>
    <p class="selection-status" role="status" aria-live="polite"></p>
  </section>`;
}

function prepareResults() {
  result = candidates(answers);
  resultIndex = 0;
  confirmed = false;
  exhausted = false;
}

function renderResults() {
  const candidate = result[resultIndex];
  const f = candidate.film;
  main.innerHTML = `<section class="results single-result enter">
    <p class="eyebrow"><span class="live-dot"></span> A FILM FOR TONIGHT / 今晚的电影</p>
    <article class="single-card" style="--film-color:${f.color}">
      <div class="film-art ${f.motif}" aria-hidden="true"><div class="film-art-top">EMBER SELECTS</div><div class="film-symbol"></div><span class="poster-title">${escape(f.title)}</span><span class="poster-year">${f.year}</span></div>
      <div class="single-title"><p class="scene-label">${confirmed ? 'YOUR CHOICE / 今晚的选择' : 'SELECTED FOR THIS MOMENT'}</p>
        <h1 tabindex="-1">${escape(f.zh)}</h1><p class="original-title">${escape(f.title)}</p>
        <p class="film-meta">${f.year} · ${escape(f.region)} · ${escape(f.style)}</p>
      </div>
      <div class="single-reason"><p class="reason-label">为什么推荐它</p><p class="headline-reason">${escape(headlineReason(candidate))}</p>
        <details class="film-details"><summary>影片简介与匹配依据</summary><p>${escape(f.summary)}</p>${candidate.reasons.map(r => `<p><strong>${escape(r.choice)}</strong>：${escape(r.reason)}</p>`).join('')}<p class="muted">对应 ${candidate.reasons.length} / 3 个选择；仅解释实际匹配的偏好。部分影片包含暴力或沉重主题。</p></details>
      </div>
      <div class="single-actions"><p id="confirm-status" class="confirm-status" role="status">${confirmed ? '今晚就看这部。' : ''}</p>
        <div class="result-actions"><button class="primary" data-action="confirm" ${confirmed ? 'disabled' : ''}>${confirmed ? '已选定' : '就看这部'} <span aria-hidden="true">✓</span></button><button class="secondary" data-action="swap" ${exhausted ? 'disabled' : ''}>换一部 <span aria-hidden="true">↻</span></button></div>
        <p id="candidate-status" class="candidate-status" role="status">${exhausted ? '符合这次选择的候选已看完。可以修改选择，寻找新的方向。' : ''}</p>
        <div class="secondary-actions">${confirmed ? '<button class="text-button" data-action="copy">复制片名与理由</button>' : ''}<button class="text-button" data-edit="0">修改选择</button><button class="text-button" data-action="restart">重新体验</button></div>
        <p id="copy-status" class="copy-status" role="status" aria-live="polite"></p>
        <div id="copy-fallback" hidden><label for="copy-text">请选中下方结果手动复制：</label><textarea id="copy-text" readonly rows="5"></textarea></div>
      </div>
    </article>
    <div class="answer-summary" aria-label="你的选择">${questions.map((q, i) => `<button data-edit="${i}" aria-label="修改第 ${i + 1} 题：${q.choices[answers[i]].short}"><span>0${i + 1}</span> ${q.choices[answers[i]].short} <span aria-hidden="true">↗</span></button>`).join('')}</div>
  </section>`;
}

function copyText() {
  const candidate = result[resultIndex];
  const f = candidate.film;
  return [`今晚就看这部。`, `${f.zh} / ${f.title} (${f.year})`, headlineReason(candidate), ...questions.map((q, i) => `${i + 1}. ${q.choices[answers[i]].label}`), 'Cinema Experiment · Ember Lab · https://lab.mariustang.com/'].join('\n');
}

async function copyResults(button) {
  const version = viewVersion;
  const text = copyText();
  const status = main.querySelector('#copy-status');
  button.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (version !== viewVersion) return;
    status.textContent = '已复制片名与推荐理由。';
    main.querySelector('#copy-fallback').hidden = true;
  } catch {
    if (version !== viewVersion) return;
    status.textContent = '复制失败：浏览器未允许访问剪贴板，请手动复制下方结果。';
    const fallback = main.querySelector('#copy-fallback');
    fallback.hidden = false;
    const field = fallback.querySelector('textarea');
    field.value = text;
    field.focus();
    field.select();
  } finally {
    if (version === viewVersion) button.disabled = false;
  }
}

function select(choice) {
  if (advancing) return;
  advancing = true;
  answers[scene] = choice;
  main.querySelectorAll('[data-choice]').forEach((button, i) => {
    button.classList.toggle('selected', i === choice);
    button.setAttribute('aria-pressed', i === choice);
    button.setAttribute('aria-disabled', 'true');
    button.querySelector('.choice-mark').textContent = i === choice ? '✓' : '↗';
  });
  main.querySelector('.selection-status').textContent = `已选择：${questions[scene].choices[choice].short}`;
  // A brief feedback frame; lock repeated taps so they cannot answer the next scene.
  transitionTimer = setTimeout(() => {
    scene++;
    if (scene === 3) prepareResults();
    render();
  }, reducedMotion.matches ? 80 : 180);
}

main.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.hasAttribute('data-choice')) { select(Number(button.dataset.choice)); return; }
  if (button.hasAttribute('data-edit')) { scene = Number(button.dataset.edit); render(); return; }
  switch (button.dataset.action) {
    case 'begin': trackFunnel('start'); scene = 0; break;
    case 'back': scene--; break;
    case 'restart': answers.fill(null); result = []; scene = -1; break;
    case 'confirm':
      confirmed = true;
      render({focus: false});
      main.querySelector('[data-action="copy"]').focus({preventScroll: true});
      return;
    case 'swap':
      if (resultIndex + 1 >= result.length) {
        exhausted = true;
        const status = main.querySelector('#candidate-status');
        status.textContent = '符合这次选择的候选已看完。可以修改选择，寻找新的方向。';
        button.disabled = true;
        main.querySelector('[data-edit="0"]').focus({preventScroll: true});
        return;
      }
      resultIndex++;
      confirmed = false;
      render();
      return;
    case 'copy': copyResults(button); return;
    default: return;
  }
  render();
});

document.addEventListener('keydown', event => {
  if (scene < 0 || scene > 2 || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches('input, textarea, select')) return;
  const key = event.key.toLowerCase();
  const choice = {'a': 0, 'b': 1, 'c': 2, '1': 0, '2': 1, '3': 2}[key];
  if (choice !== undefined) { event.preventDefault(); select(choice); }
  else if (key === 'escape') { event.preventDefault(); scene--; render(); }
  else if (key === 'arrowright' || key === 'arrowleft') {
    event.preventDefault();
    if (advancing) return;
    const buttons = [...main.querySelectorAll('[data-choice]')];
    const current = buttons.indexOf(document.activeElement);
    const next = current < 0 ? (key === 'arrowright' ? 0 : 2) : (current + (key === 'arrowright' ? 1 : 2)) % 3;
    buttons[next].focus();
  }
});
render();

mountCloudVault({site:'cinema',getState:()=>({schema:1,data:{answers:[...answers],scene,resultIndex,confirmed}}),restore:payload=>{
 const d=payload?.data;
 if(payload?.schema!==1||!d||!Array.isArray(d.answers)||d.answers.length!==3||!d.answers.every(v=>v===null||Number.isInteger(v)&&v>=0&&v<=2)||!Number.isInteger(d.scene)||d.scene< -1||d.scene>3||d.scene===3&&d.answers.some(v=>v===null)||!Number.isInteger(d.resultIndex)||d.resultIndex<0||typeof d.confirmed!=='boolean')throw Error('invalid_payload');
 clearTimeout(transitionTimer);answers.splice(0,3,...d.answers);scene=d.scene;
 if(scene===3){prepareResults();resultIndex=Math.min(d.resultIndex,result.length-1);confirmed=d.confirmed}
 render();
},analytics:{enabled:analyticsConfig.liveEnabled&&analyticsConfig.productionOrigins.includes(location.origin),token:analyticsConfig.projectToken,apiHost:analyticsConfig.apiHost}});
