import {
  enrichInvestigationForUI,
  processedInvestigations,
  rankLocalInvestigations,
} from './ranking.js';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  firehazrMetadata: () => request('/analytics/firehazr'),
  firehazrPresets: () => request('/analytics/firehazr/presets'),
  predictFirehazr: (conditions, { signal } = {}) => request('/analytics/firehazr/predict', {
    method: 'POST', body: JSON.stringify(conditions), signal,
  }),
  interpretFirehazr: (payload, { signal } = {}) => request('/analytics/firehazr/interpret', {
    method: 'POST', body: JSON.stringify(payload), signal,
  }),
  listInvestigations: async (params = {}) => {
    try {
      const data = await request(`/investigations?${new URLSearchParams(params)}`);
      const items = (data.items ?? []).map((inv) => enrichInvestigationForUI(inv));
      return { ...data, items, total: data.total ?? items.length, source: 'api' };
    } catch {
      const items = processedInvestigations.map((inv) => enrichInvestigationForUI(inv));
      return { items, total: items.length, source: 'local-processed-fallback' };
    }
  },

  getInvestigation: async (id) => {
    try {
      const doc = await request(`/investigations/${encodeURIComponent(id)}`);
      return enrichInvestigationForUI(doc);
    } catch {
      const lower = String(id).toLowerCase();
      const all = processedInvestigations.map((inv) => enrichInvestigationForUI(inv));
      const found =
        all.find(
          (item) =>
            item.id === lower ||
            String(item.psiId ?? '').toLowerCase() === lower ||
            String(item.acronym ?? '').toLowerCase() === lower
        );
      if (!found) throw new Error(`Investigation "${id}" not found`);
      return found;
    }
  },

  rank: async (scenario, weights = {}) => {
    try {
      const res = await request('/ranking', {
        method: 'POST',
        body: JSON.stringify({ scenario, weights }),
      });
      if (Array.isArray(res?.results) && res.results.length > 0) {
        let results = res.results.map((item) => ({
          ...item,
          investigation: enrichInvestigationForUI(item.investigation, item),
        }));
        if (scenario?.category && scenario.category !== 'all') {
          results = results.filter(
            (r) => r.investigation.category === scenario.category
          );
        }
        if (scenario?.fuelType && scenario.fuelType !== 'all') {
          results = results.filter(
            (r) => r.investigation.fuelType === scenario.fuelType
          );
        }
        return {
          ...res,
          count: results.length,
          results,
          source: 'api',
        };
      }
      throw new Error('Empty API ranking response');
    } catch {
      const results = rankLocalInvestigations(scenario, weights);
      return {
        scenario,
        count: results.length,
        results,
        source: 'local-processed-fallback',
      };
    }
  },

  chatStatus: () => request('/chat/status'),

  ask: (question, optionsOrSessionId = {}) => {
    const opts =
      typeof optionsOrSessionId === 'string'
        ? { sessionId: optionsOrSessionId }
        : optionsOrSessionId ?? {};
    return request('/chat', {
      method: 'POST',
      body: JSON.stringify({
        question,
        ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
        ...(opts.audience ? { audience: opts.audience } : {}),
        ...(opts.scenario ? { scenario: opts.scenario } : {}),
      }),
    });
  },

  pollChatSession: (sessionId, baselineCount = 0) =>
    request(
      `/chat/sessions/${encodeURIComponent(sessionId)}?baselineCount=${encodeURIComponent(baselineCount)}`
    ),

  trends: (series) =>
    request('/analytics/trends', { method: 'POST', body: JSON.stringify({ series }) }),

  flammabilityMap: (points, grid) =>
    request('/analytics/flammability-map', {
      method: 'POST',
      body: JSON.stringify({ points, grid }),
    }),
};
