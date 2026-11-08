import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostHogSender} from '../js/posthog-transport.js';
const config={apiHost:'https://us.i.posthog.com',projectToken:'phc_localTestOnly',site:'cinema',traffic:'test'};
test('only three custom events and explicitly allowed anonymous properties',async()=>{
 const received=[];const emit=createPostHogSender({...config,send:async(url,options)=>{received.push({url,options,body:JSON.parse(options.body)});return {ok:true};}});
 for(const name of ['cinema_open','cinema_start','cinema_complete'])await emit(name,{source:'wechat_moments'});
 assert.deepEqual(received.map(r=>r.body.event),['funnel_open','funnel_start','funnel_complete']);
 for(const r of received){
  assert.equal(r.url,'https://us.i.posthog.com/capture/');assert.equal(r.options.credentials,'omit');assert.equal(r.options.referrerPolicy,'no-referrer');
  assert.deepEqual(r.body.properties,{distinct_id:'ember-funnel-aggregate',site:'cinema',source:'wechat_moments',traffic:'test',$process_person_profile:false,$geoip_disable:true});
 }
 await emit('$pageview',{source:'wechat_moments'});assert.equal(received.length,3);
});
test('Puzzle uses same project with separate site; capture failure is observable to caller',async()=>{
 let event;await createPostHogSender({...config,site:'puzzle',send:async(_,o)=>{event=JSON.parse(o.body);return {ok:true};}})('cinema_open',{source:'wechat_moments'});assert.equal(event.properties.site,'puzzle');
 await assert.rejects(()=>createPostHogSender({...config,send:async()=>({ok:false,status:403})})('cinema_open',{source:'wechat_moments'}),/403/);
});
test('refuses foreign hosts, missing keys and non-enumerated sites/traffic',()=>{
 for(const patch of [{apiHost:'https://other.example'},{projectToken:''},{site:'private-site'},{traffic:'personal'}])assert.throws(()=>createPostHogSender({...config,...patch}),TypeError);
});
