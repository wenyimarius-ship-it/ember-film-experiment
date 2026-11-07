import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {recommend,candidates,headlineReason} from '../js/engine.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const deployment=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const securityHeaders=Object.fromEntries(deployment.headers[0].headers.map(h=>[h.key,h.value]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
    if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
    const content=await readFile(file);res.writeHead(200,{...securityHeaders,'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(content);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
await mkdir(path.join(root,'test-results'),{recursive:true});
let browser;
const errors=[];
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>assert.ok(r.url().startsWith(base),'no third-party runtime requests'));
  await page.goto(base);
  assert.equal(await page.title(),'What Would You Watch? — Cinema Experiment · Ember Lab');
  assert.equal(await page.locator('#lab-link').getAttribute('href'),'https://lab.mariustang.com/');
  await page.screenshot({path:root+'test-results/desktop-intro.png',fullPage:true});
  const heading=()=>page.locator('h1');
  const choose=async answer=>{
    const old=await page.getByRole('progressbar').getAttribute('aria-valuenow');
    await page.locator(`[data-choice="${answer}"]`).click();
    await page.waitForFunction(old=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==old,old);
  };
  const start=async()=>{await page.goto(base);await page.getByRole('button',{name:'开始选',exact:true}).click();};
  const expectFilm=async candidate=>{
    assert.equal(await heading().textContent(),candidate.film.zh);
    assert.equal(await page.locator('.single-card').count(),1);
    assert.equal(await page.locator('.headline-reason').textContent(),headlineReason(candidate));
  };
  // A–D, G: all answer combinations and every finite, grounded swap candidate.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++) {
    await start();
    for(const answer of [a,b,c])await choose(answer);
    const pool=candidates([a,b,c]);
    await expectFilm(pool[0]);
    assert.equal(pool[0].film.id,recommend([a,b,c])[0].film.id);
    const seen=new Set([pool[0].film.id]);
    for(const candidate of pool.slice(1)) {
      await page.getByRole('button',{name:'换一部',exact:true}).click();
      await expectFilm(candidate);
      assert.ok(!seen.has(candidate.film.id));seen.add(candidate.film.id);
    }
    // E: no wraparound when the pool is exhausted.
    await page.getByRole('button',{name:'换一部',exact:true}).click();
    assert.ok(await page.getByRole('button',{name:'换一部',exact:true}).isDisabled());
    assert.ok((await page.locator('#candidate-status').textContent()).includes('候选已看完'));
    await expectFilm(pool.at(-1));
  }
  console.log('PASS A/C/D/E/G: all 27 combinations, original first result, every swap candidate, grounded reasons, finite exhaustion');
  // B: return while answering, change answer, and recalculate after editing result.
  await start();await choose(1);
  await page.getByRole('button',{name:'上一题'}).click();
  assert.equal(await page.locator('[data-choice="1"]').getAttribute('aria-pressed'),'true');
  await choose(0);await choose(2);await choose(0);
  await expectFilm(candidates([0,2,0])[0]);
  await page.getByRole('button',{name:'修改第 2 题',exact:false}).click();
  assert.equal(await page.locator('[data-choice="2"]').getAttribute('aria-pressed'),'true');
  await choose(0);await choose(0);
  await expectFilm(candidates([0,0,0])[0]);
  // F: explicit confirmation followed by copy with feedback and a denied-permission fallback.
  await page.getByRole('button',{name:'就看这部',exact:true}).click();
  assert.equal(await page.locator('#confirm-status').textContent(),'今晚就看这部。');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));
  await page.getByRole('button',{name:'复制片名与理由'}).click();
  await page.locator('#copy-status').filter({hasText:'已复制'}).waitFor();
  const copied=await page.evaluate(()=>window.copied);
  assert.ok(copied.includes(candidates([0,0,0])[0].film.zh));
  assert.ok(copied.includes(headlineReason(candidates([0,0,0])[0])));
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
  await page.getByRole('button',{name:'复制片名与理由'}).click();
  await page.locator('#copy-fallback').waitFor({state:'visible'});
  assert.equal(await page.locator('#copy-text').inputValue(),copied);
  // A late clipboard promise must not overwrite the next film or throw.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise((_,reject)=>window.rejectCopy=reject)}}));
  await page.getByRole('button',{name:'复制片名与理由'}).click();
  await page.getByRole('button',{name:'换一部',exact:true}).click();
  await page.evaluate(()=>window.rejectCopy(Error('late rejection')));
  await expectFilm(candidates([0,0,0])[1]);
  assert.equal(await page.locator('#confirm-status').textContent(),'');
  console.log('PASS B/F: back/edit recalculation, confirm, clipboard success/failure and stale asynchronous clipboard guard');
  // Keyboard: Tab/Enter, letters, digits, arrows, Space and Escape.
  await page.goto(base);
  await page.getByRole('button',{name:'开始选',exact:true}).focus();await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-choice="0"]').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='2');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'1');
  await page.keyboard.press('b');
  await page.waitForFunction(()=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='2');
  await page.keyboard.press('3');
  await page.waitForFunction(()=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='3');
  await page.locator('[data-choice="0"]').focus();await page.keyboard.press('Space');
  await page.locator('.single-card').waitFor();
  await expectFilm(candidates([1,2,0])[0]);
  // H: mobile/desktop first-fold controls, each scene screenshot and no horizontal overflow.
  const inFold=async locator=>{const b=await locator.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=844,'essential element visible in first viewport');};
  for(const width of [320,375,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    await page.goto(base);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`intro overflow ${width}`);
    await inFold(page.getByRole('button',{name:'开始选',exact:true}));await inFold(heading());
    if(width===375||width===1440)await page.screenshot({path:root+`test-results/${width}-intro.png`});
    await page.getByRole('button',{name:'开始选',exact:true}).click();
    for(let i=0;i<3;i++) {
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`scene ${i} overflow ${width}`);
      assert.equal(await page.getByRole('group',{name:'情境选项'}).getByRole('button').count(),3);
      if(width===375)await page.screenshot({path:root+`test-results/375-scene-${i+1}.png`});
      await choose(1);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`results overflow ${width}`);
    if(width===375||width===1440) {
      await inFold(heading());await inFold(page.locator('.headline-reason'));await inFold(page.getByRole('button',{name:'就看这部',exact:true}));
      await page.screenshot({path:root+`test-results/${width}-result.png`});
    }
    assert.equal(await page.locator('.enter').evaluate(el=>getComputedStyle(el).animationName),'none');
  }
  // No remote poster/image dependency: blocking every image still leaves original CSS cover and title.
  await page.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  await start();for(const answer of [2,0,2])await choose(answer);
  assert.equal(await page.locator('img').count(),0);
  assert.ok(await page.locator('.film-art').isVisible());
  assert.ok(await heading().isVisible());
  // Normal-motion mode: selected state is immediate and double taps don't skip a question.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await start();
  await page.locator('[data-choice="0"]').evaluate(el=>{el.click();el.click();});
  assert.equal(await page.locator('[data-choice="0"]').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='2');
  await page.waitForTimeout(250);
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
  assert.deepEqual(errors,[]);
  console.log('PASS H/accessibility: 320/375/390/768/1440px, first-fold controls, three scene screenshots, keyboard, reduced motion, image blocking, double-tap guard; no page/CSP errors or external runtime requests');
  await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
