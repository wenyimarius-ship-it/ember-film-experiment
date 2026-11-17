import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {candidates,headlineReason} from '../js/engine.js';
import {questions} from '../js/questions.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const deployment=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const headers=Object.fromEntries(deployment.headers[0].headers.map(h=>[h.key,h.value]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
  const body=await readFile(file);res.writeHead(200,{...headers,'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
await mkdir(path.join(root,'test-results'),{recursive:true});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 const answers=[0,2,1],pool=candidates(answers),inception=pool.findIndex(c=>c.film.id==='inception');
 assert.ok(inception>=0);
 const errors=[];
 for(const width of [320,375,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))errors.push(`External request: ${r.url()}`);});
  await page.addInitScript(()=>{
   const original=CanvasRenderingContext2D.prototype.fillText;
   window.posterDraws=[];
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
    const metrics=this.measureText(text);
    const point=new DOMPoint(x,y).matrixTransform(this.getTransform());
    window.posterDraws.push({text,x:point.x,y:point.y,right:point.x+metrics.width,height:this.canvas.height,width:this.canvas.width});
    return original.call(this,text,x,y,...rest);
   };
  });
  await page.goto(base);
  await page.getByRole('button',{name:'开始选',exact:true}).click();
  for(let i=0;i<3;i++){
   await page.locator(`[data-choice="${answers[i]}"]`).click();
   await page.waitForFunction(n=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==String(n),i+1);
  }
  for(let i=0;i<inception;i++)await page.getByRole('button',{name:'换一部',exact:true}).click();
  const candidate=pool[inception],f=candidate.film;
  assert.equal(await page.locator('h1').textContent(),f.zh);
  assert.equal(await page.locator('.film-details').getAttribute('open'),null,'export works while details remain collapsed');
  assert.ok(await page.locator('.single-title h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<=(width>640?32:23));
  assert.ok(await page.locator('.headline-reason').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<=13);
  const save=page.getByRole('button',{name:'保存电影海报',exact:true});
  assert.ok((await save.getAttribute('class')).includes('primary'));
  await save.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'保存电影海报',exact:true});
  const image=dialog.locator('.poster-preview img');
  await image.waitFor({state:'visible'});
  const data=await image.getAttribute('src');assert.ok(data.startsWith('data:image/png;base64,'));
  const download=dialog.getByRole('link',{name:'下载 PNG',exact:false});
  assert.equal(await download.getAttribute('href'),data);
  assert.equal(await download.getAttribute('download'),'cinema-inception.png');
  const alt=await image.getAttribute('alt');
  for(const text of [f.zh,f.title,String(f.year),f.region,f.style,f.summary,headlineReason(candidate),...candidate.reasons.map(r=>r.reason)])assert.ok(alt.includes(text),text);
  const drawn=await page.evaluate(()=>window.posterDraws.filter(t=>t.width===1200&&t.height>=1500));
  const joined=drawn.map(t=>t.text).join('').replace(/\s/g,'');
  for(const text of [f.zh,f.title,`${f.year} · ${f.region} · ${f.style}`,f.summary,headlineReason(candidate),'为什么推荐它','影片简介','匹配依据',...candidate.reasons.map(r=>`${r.choice}：${r.reason}`)])assert.ok(joined.includes(text.replace(/\s/g,'')),`PNG really draws: ${text}`);
  assert.equal(/https?:\/\/|保存电影海报|下载 PNG|复制片名|返回 Ember/.test(joined),false,'no UI/navigation/URL is painted into PNG');
  assert.ok(drawn.every(t=>t.x>=28&&t.y>=28&&t.right<=1172&&t.y+40<t.height),'export text stays inside the poster');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('dialog'))),true,'native modal traps keyboard focus');}
  const filePromise=page.waitForEvent('download');await download.click();const file=await filePromise;
  const savedPath=path.join(root,`test-results/${width}-inception.png`);await file.saveAs(savedPath);
  const bytes=await readFile(savedPath);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),1200);assert.ok(bytes.readUInt32BE(20)>=1500);
  await page.screenshot({path:path.join(root,`test-results/${width}-poster-preview.png`),fullPage:true});
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await save.evaluate(el=>el===document.activeElement),true,'Escape restores focus to entry point');
  assert.equal(await page.locator('.poster-preview img').count(),0,'closing releases the previous image');
  await page.getByRole('button',{name:'就看这部',exact:true}).click();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));
  await page.getByRole('button',{name:'复制片名与理由',exact:true}).click();
  await page.locator('#copy-status').filter({hasText:'已复制'}).waitFor();
  const expected=['今晚就看这部。',`${f.zh} / ${f.title} (${f.year})`,headlineReason(candidate),...questions.map((q,i)=>`${i+1}. ${q.choices[answers[i]].label}`),'Cinema Experiment · Ember Lab · https://cinema.mariustang.com/'].join('\n');
  assert.equal(await page.evaluate(()=>window.copied),expected,'copy payload is byte-for-byte unchanged');
  await page.screenshot({path:path.join(root,`test-results/${width}-poster-result.png`),fullPage:true});
  // A failed encoder remains recoverable and does not disturb the result page.
  await page.evaluate(()=>{window.originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});
  await save.click();await dialog.locator('.poster-status').filter({hasText:'海报暂时无法生成'}).waitFor();
  await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.originalToBlob;});
  // Closing during generation, then swapping, must never reveal an obsolete PNG.
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=function(callback,...args){window.finishOldPoster=()=>window.originalToBlob.call(this,callback,...args);};});
  await save.click();await page.waitForFunction(()=>typeof window.finishOldPoster==='function');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'换一部',exact:true}).click();
  const next=pool[inception+1];assert.ok(next);
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.originalToBlob;window.finishOldPoster();});
  assert.equal(await page.locator('h1').textContent(),next.film.zh);
  await page.getByRole('button',{name:'保存电影海报',exact:true}).click();
  await image.waitFor({state:'visible'});
  assert.equal(await download.getAttribute('download'),`cinema-${next.film.id}.png`);
  assert.ok((await image.getAttribute('alt')).includes(next.film.zh));
  await dialog.getByRole('button',{name:'关闭海报预览',exact:true}).click();
  await context.close();
 }
 console.log('PASS poster UI/download: 320/375/1440px, smaller result type, primary entry, independent PNG with complete content while details are collapsed, no navigation/buttons/URLs, unchanged copy payload, focus/Escape, encoder failure and stale-generation protection; existing CSP unchanged, no external requests.');

 // Every catalog film: choose its most complete actual match and check all rendered text fits.
 const catalog=new Map();
 for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++)for(const candidate of candidates([a,b,c])){
  const old=catalog.get(candidate.film.id);if(!old||old.reasons.length<candidate.reasons.length)catalog.set(candidate.film.id,candidate);
 }
 assert.equal(catalog.size,35);
 const page=await browser.newPage();await page.goto(base);
 for(const candidate of catalog.values()){
  const result=await page.evaluate(async candidate=>{
   const painted=[];const original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){const point=new DOMPoint(x,y).matrixTransform(this.getTransform());painted.push({text,x:point.x,y:point.y,right:point.x+this.measureText(text).width,height:this.canvas.height});return original.call(this,text,x,y,...rest);};
   try{
    const {createMoviePoster}=await import('/js/poster.js');const poster=await createMoviePoster(candidate);
    const img=new Image();img.src=poster.src;await img.decode();
    const all=painted.filter(t=>t.height===poster.height);
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const background=[...ctx.getImageData(60,60,1,1).data];
    return {text:all.map(t=>t.text).join('').replace(/\s/g,''),width:img.naturalWidth,height:img.naturalHeight,inside:all.every(t=>t.x>=28&&t.y>=28&&t.right<=1172&&t.y+40<poster.height),background};
   }finally{CanvasRenderingContext2D.prototype.fillText=original;}
  },candidate);
  assert.equal(result.width,1200);assert.ok(result.height>=1500);assert.ok(result.inside,candidate.film.id);
  assert.deepEqual(result.background,[17,19,16,255]);
  for(const text of [candidate.film.zh,candidate.film.title,candidate.film.summary,...candidate.reasons.map(r=>r.reason)])assert.ok(result.text.includes(text.replace(/\s/g,'')),`${candidate.film.id}: complete text`);
 }
 await page.close();assert.deepEqual(errors,[]);
 console.log('PASS poster catalog: all 35 films render valid 1200px-wide PNGs; all actual matching evidence, long titles and summaries remain complete and inside the image bounds.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
