import {createFunnel, createFeedback} from './funnel.js';
import {analyticsConfig} from './analytics-config.js';
import {createPostHogSender} from './posthog-transport.js';
const params = new URLSearchParams(window.location.search);
let storage;
try { storage = window.sessionStorage; } catch { /* Storage disabled: in-memory fallback. */ }
const traffic = params.get('analytics_test') === '1' ? 'test' : 'live';
const liveAllowed = analyticsConfig.liveEnabled && analyticsConfig.productionOrigins.includes(window.location.origin);
// Freeze mode for this tab session, so a reload without test parameters cannot become live.
let sessionTraffic = traffic;
try {
  const saved = storage?.getItem('cinema.funnel.traffic.v1');
  if (traffic === 'test' || saved === 'test') sessionTraffic = 'test';
  else if (saved === 'live' && liveAllowed) sessionTraffic = 'live';
  // Merely opening a disabled, untagged Preview must not block a later test link.
  if (traffic === 'test' || liveAllowed) storage?.setItem('cinema.funnel.traffic.v1',sessionTraffic);
} catch { /* Keep in-memory mode. */ }
const enabled = analyticsConfig.projectToken && (sessionTraffic === 'test' || liveAllowed);
const emit = enabled ? createPostHogSender({
  ...analyticsConfig, traffic:sessionTraffic
}) : () => {};
const record = enabled ? createFunnel({storage,search:window.location.search,emit}) : () => false;
// Feedback requires a configured production origin, including for test traffic.
const feedback = createFeedback({storage,emit:liveAllowed ? emit : () => {}});
export function trackFunnel(node) { return record(`cinema_${node}`); }
export function feedbackRating(film_id, swap_count) { return feedback.ratingFor({film_id, swap_count}); }
export function trackFeedback(film_id, swap_count, rating) { return feedback.record({film_id, swap_count, rating}); }
