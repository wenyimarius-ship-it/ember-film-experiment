import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const counts=new Map();const received=[];
let base;
let productionOrigin='https://ember-film-experiment.vercel.app';
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,base);
  let content;
  if(url.pathname==='/js/analytics-config.js')content=`export const analyticsConfig={site:'cinema',apiHost:'https://us.i.posthog.com',projectToken:'phc_localTestOnly',liveEnabled:true,productionOrigin:'${productionOrigin}'};`;
  else content=await readFile(path.join(root,url.pathname==='/'?'index.html':url.pathname));
  res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https://us.i.posthog.com"});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:375,height:844},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];
 await page.route('https://us.i.posthog.com/capture/',async route=>{
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'}});return;}
   const body=route.request().postDataJSON();received.push(body);counts.set(body.event,(counts.get(body.event)||0)+1);
   await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},json:{status:1}});
 });
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.waitForTimeout(100);assert.equal(received.length,0,'untagged Preview does not collect or lock test mode');
 await page.goto(`${base}/?utm_source=wechat_moments&analytics_test=1&answer=DO_NOT_SEND`);
 await page.getByRole('button',{name:'开始选',exact:true}).click();
 for(let i=0;i<3;i++){
  await page.locator('[data-choice="1"]').click();
  await page.waitForFunction(n=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==String(n),i+1);
 }
 await page.waitForFunction(()=>document.querySelector('.single-card'));
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'换一部',exact:true}).click();
 await page.getByRole('button',{name:'就看这部',exact:true}).click();
 await page.getByRole('button',{name:'修改选择',exact:true}).click();
 for(let i=0;i<3;i++){
  await page.locator('[data-choice="0"]').click();
  await page.waitForFunction(n=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==String(n),i+1);
 }
 // Reload without query string: source/test mode and all three once-only flags persist.
 await page.goto(base);await page.getByRole('button',{name:'开始选',exact:true}).click();
 await page.waitForTimeout(300);
 assert.equal(received.length,3);assert.equal(counts.size,3);assert.ok([...counts.values()].every(v=>v===1));
 assert.deepEqual(received.map(r=>r.event),['funnel_open','funnel_start','funnel_complete']);
 for(const r of received)assert.deepEqual(r.properties,{distinct_id:'ember-funnel-aggregate',site:'cinema',source:'wechat_moments',traffic:'test',$process_person_profile:false,$geoip_disable:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: actual Cinema flow + intercepted PostHog capture (not cloud ingestion): open/start/complete each1; swaps/edit/reload no duplicates; source and test mode persist; no answer transmitted');
 await context.close();
 // Production-mode verification uses a fresh context and mock responses, never cloud events.
 productionOrigin=base;
 for(const query of ['?utm_source=wechat_moments','']) {
  const fresh=await browser.newContext({reducedMotion:'reduce'});const tab=await fresh.newPage();const prod=[];
  await tab.route('https://us.i.posthog.com/capture/',async route=>{
   if(route.request().method()!=='OPTIONS')prod.push(route.request().postDataJSON());
   await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'},json:{status:1}});
  });
  await tab.goto(base+query);await tab.getByRole('button',{name:'开始选',exact:true}).click();
  for(let i=0;i<3;i++){await tab.locator('[data-choice="0"]').click();await tab.waitForFunction(n=>document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')!==String(n),i+1);}
  await tab.waitForTimeout(200);
  assert.equal(prod.length,query?3:0);
  for(const event of prod){assert.equal(event.properties.source,'wechat_moments');assert.equal(event.properties.traffic,'live');}
  await fresh.close();
 }
 console.log('PASS: non-production host cannot send live; production WeChat emits3 live events; direct production visit emits0');

}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
