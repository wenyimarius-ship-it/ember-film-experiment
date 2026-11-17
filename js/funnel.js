import {films} from './films.js';

// Session-level bookkeeping only. No session ID or answers.
export const funnelEvents = Object.freeze(['cinema_open', 'cinema_start', 'cinema_complete']);
const storageKey = 'cinema.funnel.v1';
const sources = new Set(['wechat_moments', 'direct', 'other']);

export function createFunnel({storage, search = '', emit}) {
  const incomingSource = new URLSearchParams(search).get('utm_source');
  let state = {
    source: incomingSource === 'wechat_moments' ? 'wechat_moments' : incomingSource ? 'other' : 'direct',
    sent: []
  };
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (saved && sources.has(saved.source) && Array.isArray(saved.sent)) {
      state = {source: saved.source, sent: saved.sent.filter(event => funnelEvents.includes(event))};
    }
  } catch { /* Storage denied/corrupted: keep in-memory deduplication. */ }

  return function record(event) {
    if (!funnelEvents.includes(event) || state.sent.includes(event)) return false;
    // Record an attempt before emitting: retries/re-renders must not double-count.
    state.sent.push(event);
    try { storage?.setItem(storageKey, JSON.stringify(state)); } catch { /* No impact on the cinema flow. */ }
    try {
      Promise.resolve(emit(event, {source: state.source})).catch(() => {});
    } catch { /* Analytics failures must never block choosing a film. */ }
    return true;
  };
}

export const feedbackRatings = Object.freeze(['accurate', 'partial', 'off']);
const filmIds = new Set(films.map(film => film.id));
export function feedbackKey(data) {
  if (!data || typeof data !== 'object') return null;
  const {film_id, swap_count} = data;
  return filmIds.has(film_id) && Number.isSafeInteger(swap_count) && swap_count >= 0 && swap_count < films.length
    ? `${film_id}:${swap_count}` : null;
}

// The catalog ID identifies the title; its candidate position is the swap count.
export function createFeedback({storage, emit}) {
  const key = 'cinema.feedback.v1';
  const sent = new Map();
  try {
    const saved = JSON.parse(storage?.getItem(key) || '[]');
    if (Array.isArray(saved)) for (const item of saved) {
      if (item && feedbackKey(item) && feedbackRatings.includes(item.rating)) {
        const {film_id, swap_count, rating} = item;
        sent.set(feedbackKey(item), {film_id, swap_count, rating});
      }
    }
  } catch { /* Storage disabled/corrupt: use page-memory deduplication. */ }
  return {
    ratingFor(recommendation) { return sent.get(feedbackKey(recommendation))?.rating; },
    record(data) {
      const id = feedbackKey(data);
      if (!id || !feedbackRatings.includes(data.rating) || sent.has(id)) return false;
      const {film_id, swap_count, rating} = data;
      const properties = {film_id, swap_count, rating};
      // Mark before attempting delivery; a blocked/offline request is never retried.
      sent.set(id, properties);
      try { storage?.setItem(key, JSON.stringify([...sent.values()])); } catch { /* Keep memory state. */ }
      try { Promise.resolve(emit('cinema_feedback', properties)).catch(() => {}); } catch { /* Never block the film flow. */ }
      return true;
    }
  };
}
