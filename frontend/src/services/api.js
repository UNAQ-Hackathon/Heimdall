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
      let items = (data.items ?? []).map((inv) => enrichInvestigationForUI(inv));
      const hasFilters = Object.values(params).some((v) => v != null && v !== '' && v !== 'all');
      if (!hasFilters) {
        const seenAcronyms = new Set(items.map((i) => String(i.acronym ?? '').toLowerCase()).filter(Boolean));
        const missing = processedInvestigations
          .map((inv) => enrichInvestigationForUI(inv))
          .filter((inv) => !seenAcronyms.has(String(inv.acronym ?? '').toLowerCase()));
        if (missing.length > 0) {
          items = [...items, ...missing];
        }
      }
      return { ...data, items, total: items.length, source: 'api' };
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
      const lower = String(id ?? '').toLowerCase();
      const normalized = lower.replace(/^psi-/, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const all = processedInvestigations.map((inv) => enrichInvestigationForUI(inv));
      const found = all.find(
        (item) =>
          item.id === lower ||
          item.id === normalized ||
          String(item.slug ?? '').toLowerCase() === lower ||
          String(item.psiId ?? '').toLowerCase() === lower ||
          String(item.acronym ?? '').toLowerCase() === lower ||
          String(item.name ?? '').toLowerCase() === lower
      );
      if (!found) throw new Error(`Investigation "${id}" not found`);
      return found;
    }
  },

  getStudyTelemetry: async (id) => {
    try {
      const path = id
        ? `/investigations/${encodeURIComponent(id)}/telemetry`
        : '/telemetry';
      const data = await request(path);
      return {
        ...data,
        investigation: data.investigation
          ? enrichInvestigationForUI(data.investigation)
          : null,
      };
    } catch {
      const investigation = id ? await api.getInvestigation(id) : null;
      return {
        investigation,
        experiments: [],
        measurements: [],
        source: 'local-processed-fallback',
      };
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

  /**
   * Streaming chat — POST /api/chat with SSE. onEvent(type, data) receives
   * 'tool_call' / 'tool_result' events live; resolves with the 'answer' payload.
   */
  askStream: async (question, opts = {}, onEvent) => {
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        question,
        stream: true,
        ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
        ...(opts.audience ? { audience: opts.audience } : {}),
        ...(opts.scenario ? { scenario: opts.scenario } : {}),
      }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = null;
    let streamError = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');

      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = block.match(/^event: (.+)$/m)?.[1]?.trim();
        const rawData = block.match(/^data: ([\s\S]+)$/m)?.[1];
        if (!event || rawData == null) continue;
        let data = null;
        try {
          data = JSON.parse(rawData);
        } catch {
          continue;
        }
        if (event === 'answer') answer = data;
        else if (event === 'error') streamError = data;
        else onEvent?.(event, data);
      }
    }

    if (answer) return answer;
    if (streamError) throw new Error(streamError.message ?? 'Chat stream error');
    throw new Error('Chat stream ended without an answer.');
  },

  trends: (series) =>
    request('/analytics/trends', { method: 'POST', body: JSON.stringify({ series }) }),

  flammabilityMap: (points, grid) =>
    request('/analytics/flammability-map', {
      method: 'POST',
      body: JSON.stringify({ points, grid }),
    }),

  summarizeStudy: async (id, audience = 'Engineer') => {
    try {
      return await request(`/investigations/${encodeURIComponent(id)}/summarize`, {
        method: 'POST',
        body: JSON.stringify({ audience }),
      });
    } catch {
      return {
        summary: null,
        unavailable: true,
        status: 'unavailable',
        reason: 'API server unreachable; displaying local PSI specification brief.',
      };
    }
  },
};
