import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {candidates} from '../js/engine.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const headers=Object.fromEntries(config.headers[0].headers.map(h=>[h.key,h.value]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
let base, configured=true;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  let content;
  // Simulate an explicitly configured origin without touching production or sending real events.
  if(url.pathname==='/js/analytics-config.js' && configured)content=`export const analyticsConfig={site:'cinema',apiHost:'https://us.i.posthog.com',projectToken:'phc_localTestOnly',liveEnabled:true,productionOrigins:['${base}']};`;
  else content=await readFile(path.join(root,url.pathname==='/'?'index.html':url.pathname));
  res.writeHead(200,{...headers,'Content-Type':mime[path.extname(url.pathname)]||'text/html'});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
base=`http://127.0.0.1:${server.address().port}`;
await mkdir(path.join(root,'test-results'),{recursive:true});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 const choose=async(page,answers=[0,0,0])=>{
  await page.getByRole('button',{name:'开始选',exact:true}).click();
  for(let i=0;i<3;i++){
   await page.locator(`[data-choice="${answers[i]}"]`).click();
   await page.waitForFunction(n=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==String(n),i+1);
  }
  await page.locator('.single-card').waitFor();
 };
 const group=page=>page.getByRole('group',{name:'这部准不准？',exact:true});
 const setup=async(width=375,fail=false,denyStorage=false)=>{
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  if(denyStorage)await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw Error('Storage denied');}}));
  const page=await context.newPage(), received=[], errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://us.i.posthog.com/capture/',async route=>{
   if(route.request().method()!=='OPTIONS')received.push(route.request().postDataJSON());
   await route.fulfill({status:fail?503:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'},json:{status:fail?0:1}});
  });
  return {context,page,received,errors};
 };
 const locked=async page=>{
  assert.equal(await group(page).getByRole('button').count(),3);
  for(const button of await group(page).getByRole('button').all())assert.equal(await button.isDisabled(),true);
  assert.equal(await page.locator('#feedback-status').textContent(),'谢谢你的反馈');
  assert.equal((await page.locator('#feedback-status').textContent()).includes('已记录'),false);
 };
 for(const width of [375,1440]){
  const {context,page,received,errors}=await setup(width);
  await page.goto(base+'/?analytics_test=1&answer=DO_NOT_SEND');await choose(page);
  for(let i=0;i<3;i++){
   const labels=['准','有点偏','不准'],ratings=['accurate','partial','off'];
   for(const label of labels){
    const b=group(page).getByRole('button',{name:label,exact:true});
    assert.equal(await b.isVisible(),true);assert.equal(await b.isEnabled(),true);
    const box=await b.boundingBox();assert.ok(box.width>=44 && box.height>=44,`${width}: 44px targets`);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await group(page).getByRole('button').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   assert.equal(await page.locator('.enter').evaluate(el=>getComputedStyle(el).animationName),'none');
   const button=group(page).getByRole('button',{name:labels[i],exact:true});
   const layout=()=>page.locator('.single-actions').evaluate(el=>({top:el.getBoundingClientRect().top+scrollY,height:el.getBoundingClientRect().height}));
   if(i===0){
    await group(page).getByRole('button',{name:'准',exact:true}).focus();
    for(const label of labels){
     assert.equal(await group(page).getByRole('button',{name:label,exact:true}).evaluate(el=>el===document.activeElement),true);
     if(label!=='不准')await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');
   }
   const before=await layout();
   const response=page.waitForResponse(r=>r.url()==='https://us.i.posthog.com/capture/' && r.request().method()==='POST');
   if(i===0)await page.keyboard.press('Enter');
   else if(i===1)await button.click();
   else{await button.focus();await page.keyboard.press('Space');}
   await response;await locked(page);
   assert.deepEqual(await layout(),before,'feedback does not move following controls');
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   assert.equal(received.length,i+1);
   const body=received.at(-1);
   assert.equal(body.event,'cinema_feedback');
   assert.deepEqual(body.properties,{distinct_id:'ember-funnel-aggregate',site:'cinema',rating:ratings[i],film_id:candidates([0,0,0])[i].film.id,swap_count:i,traffic:'test',$process_person_profile:false,$geoip_disable:true});
   await button.evaluate(el=>{el.click();el.click();});
   await page.waitForTimeout(50);assert.equal(received.length,i+1,'locked buttons cannot double-send');
   if(i===0){
    await page.getByRole('button',{name:'就看这部',exact:true}).click();await locked(page);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));
    await page.getByRole('button',{name:'复制片名与理由',exact:true}).click();
    await page.locator('#copy-status').filter({hasText:'已复制'}).waitFor();
    assert.equal(received.length,1,'confirm/copy does not resubmit feedback');
   }
   if(i<2)await page.getByRole('button',{name:'换一部',exact:true}).click();
  }
  await page.screenshot({path:path.join(root,`test-results/${width}-feedback.png`),fullPage:true});
  await page.getByRole('button',{name:'修改选择',exact:true}).click();
  for(let i=0;i<3;i++){
   await page.locator('[data-choice="0"]').click();
   await page.waitForFunction(n=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==String(n),i+1);
  }
  await locked(page);assert.equal(received.length,3,'editing back to the same recommendation preserves deduplication');
  await page.goto(base);await choose(page);await locked(page);
  assert.equal(received.length,3,'refresh retains the per-title/position rating');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS feedback UI: 375/1440px, all three 44px controls, Tab/Enter/Space and click, lock/thanks, swap reset, confirm/copy/edit/reload, no click layout shift, reduced motion; exact test event whitelist with no answers.');

 // Actual configuration: localhost and an unconfigured hostname never emit feedback, including test URLs.
 configured=false;
 for(const host of [base,base.replace('127.0.0.1','localhost')]){
  const {context,page,received,errors}=await setup();
  await page.goto(host+'/?analytics_test=1');await choose(page);
  await group(page).getByRole('button',{name:'准',exact:true}).click();await locked(page);
  await page.waitForTimeout(100);assert.equal(received.length,0);
  assert.deepEqual(errors,[]);await context.close();
 }
 configured=true;
 // A test query overrides an existing live session, then remains test after the query is removed.
 {
  const {context,page,received,errors}=await setup();
  await page.goto(base);await choose(page);
  const rate=async label=>{const response=page.waitForResponse(r=>r.url().endsWith('/capture/')&&r.request().method()==='POST');await group(page).getByRole('button',{name:label,exact:true}).click();await response;};
  await rate('准');assert.equal(received.at(-1).properties.traffic,'live');
  await page.goto(base+'/?analytics_test=1');await choose(page);
  await page.getByRole('button',{name:'换一部',exact:true}).click();await rate('有点偏');
  assert.equal(received.at(-1).properties.traffic,'test');
  await page.goto(base);await choose(page);
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'换一部',exact:true}).click();
  await rate('不准');assert.equal(received.at(-1).properties.traffic,'test');
  assert.deepEqual(errors,[]);await context.close();
 }
 // Failed capture and denied storage still allow acknowledgement, confirmation and swapping.
 {
  const {context,page,received,errors}=await setup(375,true,true);
  await page.goto(base+'/?analytics_test=1');await choose(page);
  const response=page.waitForResponse(r=>r.url().endsWith('/capture/')&&r.request().method()==='POST');
  await group(page).getByRole('button',{name:'不准',exact:true}).click();assert.equal((await response).status(),503);
  await locked(page);
  await page.getByRole('button',{name:'就看这部',exact:true}).click();await locked(page);
  await page.getByRole('button',{name:'换一部',exact:true}).click();
  assert.equal(await group(page).getByRole('button',{name:'准',exact:true}).isEnabled(),true);
  assert.equal(received.length,1);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS feedback environment/delivery: real-config localhost/unconfigured hosts emit nothing, configured live/test, explicit test overrides prior live and persists, 503/denied storage do not block film flow; all captures mocked, no real PostHog ingestion.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
