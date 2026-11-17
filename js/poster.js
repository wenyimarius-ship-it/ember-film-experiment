import {recommendationSentence, matchHeading, matchSummary} from './recommendation-copy.js';

const colors = {bg:'#111310', ink:'#eeeee3', muted:'#a2a69a', accent:'#dce996', line:'#69724d'};
const serif = 'Georgia, "Songti SC", "Noto Serif CJK SC", serif';
const width = 1200;

function font(ctx, size, style = '') { ctx.font = `${style} ${size}px ${serif}`.trim(); }

// Measure complete Unicode text; never truncate movie titles, summaries or matching reasons.
function linesFor(ctx, text, maxWidth) {
  const result = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const character of Array.from(paragraph)) {
      if (line && ctx.measureText(line + character).width > maxWidth) {
        const space = line.lastIndexOf(' ');
        if (space > 0) { result.push(line.slice(0, space)); line = line.slice(space + 1); }
        else { result.push(line); line = ''; }
      }
      line += character;
    }
    result.push(line.trim());
  }
  return result;
}

function textBlock(ctx, text, x, y, maxWidth, size, lineHeight, color = colors.ink, style = '') {
  font(ctx, size, style);
  const lines = linesFor(ctx, text, maxWidth);
  ctx.fillStyle = color;
  for (const line of lines) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

function rule(ctx, y) {
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(108,y); ctx.lineTo(width-108,y); ctx.stroke();
}

// Original geometric cover art, using the same palette and five motifs as the on-page covers.
function cover(ctx, film, x, y, w, h) {
  ctx.save(); ctx.translate(x,y);
  ctx.beginPath(); ctx.rect(0,0,w,h); ctx.clip();
  ctx.fillStyle = film.color; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#242a25'; ctx.strokeStyle = '#242a25';
  ctx.globalAlpha = .55;
  if (film.motif === 'orbit') {
    ctx.lineWidth = w*.16;
    ctx.beginPath();ctx.arc(w*.92,h*.3,w*.4,0,Math.PI*2);ctx.stroke();
    ctx.lineWidth = 1;ctx.beginPath();ctx.arc(w*.92,h*.3,w*.52,0,Math.PI*2);ctx.stroke();
  } else if (film.motif === 'horizon') {
    ctx.beginPath();ctx.arc(w*.62,h*.31,w*.32,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=film.color;
    for(let i=0;i<7;i++)ctx.fillRect(0,h*.32+i*12,w,4);
  } else {
    ctx.save();ctx.translate(w*.55,h*.25);ctx.rotate((film.motif==='pulse'?-25:film.motif==='grid'?25:35)*Math.PI/180);
    if(film.motif==='pulse')for(let i=-18;i<20;i++)ctx.fillRect(-w,i*13,w*2,2);
    else if(film.motif==='grid')for(let i=-8;i<9;i++)ctx.fillRect(i*36,-h,10,h*2);
    else {ctx.fillRect(-w*.22,-h,w*.12,h*2);ctx.globalAlpha=.25;ctx.fillRect(w*.06,-h,w*.12,h*2);}
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  font(ctx,32,'bold');
  const titleLines=linesFor(ctx,film.title,w-48);
  const titleY=h-54-titleLines.length*36;
  // A solid color backing keeps every title readable over its abstract geometry.
  ctx.fillStyle=film.color;ctx.fillRect(15,titleY-10,w-30,titleLines.length*36+20);
  textBlock(ctx,film.title,24,titleY,w-48,32,36,'#181c16','bold');
  textBlock(ctx,String(film.year),24,h-30,w-48,16,20,'#181c16');
  ctx.restore();
}

export async function createMoviePoster(candidate) {
  await document.fonts?.ready;
  const film = candidate.film;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  // Layout is measured first; the final PNG grows to include all matching evidence.
  const measure = canvas.getContext('2d');
  if (!measure) throw new Error('Canvas unavailable');
  measure.textBaseline='top';
  const titleY=textBlock(measure,film.zh,480,330,612,52,68);
  const originalY=textBlock(measure,film.title,480,titleY+8,612,34,46,colors.ink,'italic');
  const metaBottom=textBlock(measure,`${film.year} · ${film.region} · ${film.style}`,480,originalY+24,612,25,38);
  const sections=[
    {label:'为什么推荐它', paragraphs:[recommendationSentence(candidate)]},
    {label:'影片简介', paragraphs:[film.summary]},
    {label:'匹配依据', paragraphs:candidate.reasons.map(reason=>`${matchHeading(reason)}：${reason.reason}`)}
  ];
  let y=Math.max(770,metaBottom+44);
  const layout=sections.map(section=>{
    const item={...section,top:y};
    y+=42;
    font(measure,27);
    for(const paragraph of section.paragraphs)y+=linesFor(measure,paragraph,984).length*45+12;
    y+=30;
    return item;
  });
  const note=matchSummary(candidate);
  font(measure,23);
  const noteY=y+12;
  y+=linesFor(measure,note,984).length*36+76;
  canvas.height=Math.max(1500,Math.ceil(y+100));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=colors.bg;ctx.fillRect(0,0,width,canvas.height);
  ctx.textBaseline='top';
  ctx.strokeStyle=colors.muted;ctx.lineWidth=1.5;ctx.strokeRect(28,28,width-56,canvas.height-56);
  textBlock(ctx,'A FILM FOR TONIGHT / 今晚的电影',108,92,984,21,30,colors.accent);
  textBlock(ctx,'今晚就看这部。',108,151,984,46,62);
  rule(ctx,231);
  cover(ctx,film,108,274,310,420);
  const next=textBlock(ctx,film.zh,480,330,612,52,68);
  const after=textBlock(ctx,film.title,480,next+8,612,34,46,colors.ink,'italic');
  textBlock(ctx,`${film.year} · ${film.region} · ${film.style}`,480,after+24,612,25,38);
  for(const section of layout){
    rule(ctx,section.top-20);
    let top=textBlock(ctx,section.label,108,section.top,984,25,42,colors.accent);
    for(const paragraph of section.paragraphs)top=textBlock(ctx,paragraph,108,top,984,27,45)+12;
  }
  const end=textBlock(ctx,note,108,noteY,984,23,36,colors.muted);
  textBlock(ctx,'部分影片包含暴力或沉重主题。',108,end+18,984,23,36,colors.muted);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));
  // data: is already allowed by the existing CSP; no Vercel/header changes are needed.
  const src=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('PNG reading failed'));reader.readAsDataURL(blob);
  });
  const description=[film.zh,film.title,`${film.year} · ${film.region} · ${film.style}`,...sections.flatMap(s=>[s.label,...s.paragraphs]),note].join('\n');
  return {src,filename:`cinema-${film.id}.png`,width,height:canvas.height,description};
}

export function createPosterDialog() {
  const dialog=document.createElement('dialog');
  dialog.className='poster-dialog';
  dialog.setAttribute('aria-labelledby','poster-dialog-title');
  dialog.setAttribute('aria-describedby','poster-dialog-description');
  dialog.innerHTML=`<div class="poster-dialog-header"><div><h2 id="poster-dialog-title">保存电影海报</h2><p id="poster-dialog-description">独立排版 · PNG 图片</p></div><button class="poster-close" type="button" aria-label="关闭海报预览" autofocus>×</button></div><div class="poster-preview" aria-busy="false"></div><p class="poster-status" role="status" aria-live="polite"></p><div class="poster-dialog-actions"><a class="primary poster-download" hidden>↓ 下载 PNG</a><button class="secondary poster-close" type="button">关闭</button><span>手机也可长按图片保存。</span></div>`;
  document.body.append(dialog);
  const preview=dialog.querySelector('.poster-preview');
  const status=dialog.querySelector('.poster-status');
  const download=dialog.querySelector('.poster-download');
  let request=0, returnFocus, active=false;
  const clean=()=>{
    if(!active)return;
    active=false;
    request++;preview.replaceChildren();preview.setAttribute('aria-busy','false');
    download.removeAttribute('href');download.hidden=true;
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  };
  const close=()=>{if(dialog.open){dialog.close();clean();}};
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(!dialog.open)clean();});
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled), a[href]')].filter(el=>el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  dialog.querySelectorAll('.poster-close').forEach(button=>button.addEventListener('click',close));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}});
  return {
    close,
    async open(candidate, trigger) {
      const version=++request;returnFocus=trigger;active=true;
      preview.replaceChildren();preview.setAttribute('aria-busy','true');download.hidden=true;download.removeAttribute('href');
      status.textContent='正在生成海报…';
      if(!dialog.open)dialog.showModal();
      try{
        const poster=await createMoviePoster(candidate);
        if(version!==request||!dialog.open)return;
        const image=new Image();image.alt=poster.description;image.src=poster.src;
        await image.decode();
        if(version!==request||!dialog.open)return;
        preview.replaceChildren(image);preview.setAttribute('aria-busy','false');
        download.href=poster.src;download.download=poster.filename;download.hidden=false;
        status.textContent='';
      }catch{
        if(version!==request||!dialog.open)return;
        preview.setAttribute('aria-busy','false');status.textContent='海报暂时无法生成，请关闭后重试。';
      }
    }
  };
}
