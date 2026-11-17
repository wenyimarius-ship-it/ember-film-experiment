// Explicit capture only: no SDK, autocapture, pageviews, replay, identity or browser metadata.
import {feedbackKey, feedbackRatings} from './funnel.js';
const events = {cinema_open:'funnel_open',cinema_start:'funnel_start',cinema_complete:'funnel_complete'};
export function createPostHogSender({apiHost,projectToken,site,traffic,send=fetch}) {
  if (!['cinema','puzzle'].includes(site) || !['test','live'].includes(traffic)) throw new TypeError('Invalid funnel configuration');
  const endpoint = new URL('/capture/',apiHost);
  if (endpoint.origin !== 'https://us.i.posthog.com') throw new TypeError('Unexpected PostHog host');
  if (!/^phc_[A-Za-z0-9]+$/.test(projectToken)) throw new TypeError('Missing public PostHog project key');
  return async (name,data = {}) => {
    let event, properties;
    if (name === 'cinema_feedback') {
      if (site !== 'cinema' || !feedbackKey(data) || !feedbackRatings.includes(data.rating)) return;
      event = name;
      properties = {rating:data.rating, film_id:data.film_id, swap_count:data.swap_count};
    } else {
      if (!Object.hasOwn(events,name) || data?.source !== 'wechat_moments') return;
      event = events[name];
      properties = {source:data.source};
    }
    const response = await send(endpoint.href,{
      method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({api_key:projectToken,event,properties:{
        // One fixed non-person key fulfils the capture protocol without identifying visitors.
        // Dashboard must use Total event count, never Unique users / identity-based funnels.
        distinct_id:'ember-funnel-aggregate',site,...properties,traffic,
        $process_person_profile:false,$geoip_disable:true
      }})
    });
    if (!response.ok) throw new Error(`PostHog capture rejected (${response.status})`);
  };
}
