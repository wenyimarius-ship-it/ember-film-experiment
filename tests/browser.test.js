import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {recommend} from '../js/engine.js';
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
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>assert.ok(r.url().startsWith(base),'no third-party runtime requests'));
  await page.goto(base);
  assert.equal(await page.title(),'What Would You Watch? — Cinema Experiment · Ember Lab');
  assert.equal(await page.locator('#lab-link').getAttribute('href'),'https://lab.mariustang.com/');
  await page.screenshot({path:root+'test-results/desktop-intro.png',fullPage:true});
  await page.getByRole('button',{name:'进入放映室'}).click();
  assert.ok(await page.locator('[data-action=next]').isDisabled());
  await page.keyboard.press('b'); await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
  await page.keyboard.press('3');await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'上一题'}).click();
  assert.equal(await page.locator('[data-choice="2"]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('a');await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  assert.equal(await page.locator('.film-card').count(),3);
  const titles=await page.locator('.film-info h2').allTextContents();
  assert.deepEqual(titles,recommend([1,0,0]).map(r=>r.film.title));
  // Clipboard success and denied-permission paths are deterministic, not OS-dependent.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));
  await page.getByRole('button',{name:'复制这份片单'}).click();
  await page.getByRole('status').filter({hasText:'已复制片单'}).waitFor();
  assert.ok((await page.evaluate(()=>window.copied)).includes(titles[0]));
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
  await page.getByRole('button',{name:'复制这份片单'}).click();
  await page.locator('#copy-fallback').waitFor({state:'visible'});
  assert.ok((await page.locator('#copy-text').inputValue()).includes(titles[1]));
  await page.getByRole('button',{name:'修改第 2 题',exact:false}).click();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
  assert.equal(await page.locator('[data-choice="0"]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('c');await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-choice="0"]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.locator('.film-info h2').allTextContents(),recommend([1,2,0]).map(r=>r.film.title));
  await page.screenshot({path:root+'test-results/desktop-results.png',fullPage:true});
  // All 27 answer combinations through actual DOM controls.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++) {
    await page.locator('[data-action=restart]').click();
    await page.locator('[data-action=begin]').click();
    for(const answer of [a,b,c]) {await page.locator(`[data-choice="${answer}"]`).click();await page.locator('[data-action=next]').click();}
    assert.deepEqual(await page.locator('.film-info h2').allTextContents(),recommend([a,b,c]).map(r=>r.film.title));
  }
  console.log('PASS: 27 browser answer flows; previous/edit/restart; keyboard; clipboard success/failure; Ember link');
  // Test narrow/mobile, tablet and desktop, including all scenes.
  for(const width of [320,375,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    await page.locator('[data-action=restart]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`intro overflow at ${width}`);
    if(width===390)await page.screenshot({path:root+'test-results/mobile-intro.png',fullPage:true});
    await page.locator('[data-action=begin]').click();
    for(let i=0;i<3;i++) {
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`question ${i} overflow at ${width}`);
      if(width===390 && i===0)await page.screenshot({path:root+'test-results/mobile-question.png',fullPage:true});
      await page.locator('[data-choice="1"]').click();await page.locator('[data-action=next]').click();
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`results overflow at ${width}`);
    if(width===390)await page.screenshot({path:root+'test-results/mobile-results.png',fullPage:true});
    assert.equal(await page.locator('.enter').evaluate(el=>getComputedStyle(el).animationName),'none');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: 320/375/390/768/1440px layouts, reduced motion, no runtime errors or external requests');
  await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
