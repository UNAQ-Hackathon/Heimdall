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
  listInvestigations: (params = {}) =>
    request(`/investigations?${new URLSearchParams(params)}`),
  getInvestigation: (id) => request(`/investigations/${id}`),
  rank: (scenario, weights) =>
    request('/ranking', { method: 'POST', body: JSON.stringify({ scenario, weights }) }),
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
