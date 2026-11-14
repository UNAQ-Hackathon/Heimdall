import env from '../config/env.js';
import HttpError from '../utils/http-error.js';

const { apiKey, apiBase, model } = env.devin;

const isDevinSessionsApi = () => apiBase.includes('api.devin.ai');

function authHeaders() {
  if (!apiKey) throw new HttpError(503, 'DEVIN_API_KEY is not configured');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function buildSessionUrl(sessionId) {
  if (!sessionId) return null;
  return `https://app.devin.ai/sessions/${sessionId.replace(/^devin-/, '')}`;
}

export async function getDevinSessionStatus(sessionId) {
  const res = await fetch(`${apiBase}/v1/sessions/${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(502, `Devin API error ${res.status}`, { body: text });
  }

  const data = await res.json();
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const devinMessages = messages.filter((m) => m.type === 'devin_message');
  const latestDevin = devinMessages.at(-1) ?? null;

  return {
    sessionId: data.session_id ?? sessionId,
    sessionUrl: buildSessionUrl(data.session_id ?? sessionId),
    sessionStatus: data.status_enum ?? data.status ?? 'unknown',
    devinMessageCount: devinMessages.length,
    latestReply: latestDevin?.message ?? null,
    latestEventId: latestDevin?.event_id ?? null,
  };
}

async function runDevinSessionPrompt(prompt, { sessionId, waitMs = 15000 } = {}) {
  const headers = authHeaders();
  let activeSessionId = sessionId;
  let baselineCount = 0;

  if (activeSessionId) {
    const before = await getDevinSessionStatus(activeSessionId);
    baselineCount = before.devinMessageCount;

    const msgRes = await fetch(
      `${apiBase}/v1/sessions/${encodeURIComponent(activeSessionId)}/message`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: prompt }),
      }
    );

    if (!msgRes.ok) {
      const text = await msgRes.text();
      throw new HttpError(502, `Devin message error ${msgRes.status}`, { body: text });
    }
  } else {
    let createRes = await fetch(`${apiBase}/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, idempotent: false, devin_mode: model }),
    });

    if (createRes.status === 422 && model !== 'medium') {
      createRes = await fetch(`${apiBase}/v1/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, idempotent: false, devin_mode: 'medium' }),
      });
    }

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new HttpError(502, `Devin session creation error ${createRes.status}`, {
        body: text,
      });
    }

    const created = await createRes.json();
    activeSessionId = created.session_id;
  }

  const deadline = Date.now() + waitMs;
  let latestStatus = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    latestStatus = await getDevinSessionStatus(activeSessionId);
    if (latestStatus.devinMessageCount > baselineCount && latestStatus.latestReply) {
      return {
        content: latestStatus.latestReply,
        status: 'completed',
        sessionId: activeSessionId,
        sessionUrl: latestStatus.sessionUrl,
        sessionStatus: latestStatus.sessionStatus,
        baselineCount,
      };
    }
  }

  if (!latestStatus) {
    latestStatus = await getDevinSessionStatus(activeSessionId);
  }

  return {
    content: null,
    status: 'pending',
    sessionId: activeSessionId,
    sessionUrl: latestStatus.sessionUrl,
    sessionStatus: latestStatus.sessionStatus,
    baselineCount,
  };
}

/**
 * Devin API client — supports both `api.devin.ai/v1/sessions` (Devin agent API)
 * and OpenAI-compatible `/v1/chat/completions` endpoints.
 */
async function chat(messages, { temperature = 0.2, sessionId, waitMs } = {}) {
  if (isDevinSessionsApi()) {
    const prompt = messages
      .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
      .join('\n\n');
    return runDevinSessionPrompt(prompt, { sessionId, waitMs });
  }

  const res = await fetch(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model, messages, temperature }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(502, `Devin API error ${res.status}`, { body: text });
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    status: 'completed',
    sessionId: null,
    sessionUrl: null,
    sessionStatus: 'completed',
    baselineCount: 0,
  };
}

const SUMMARY_SYSTEM = [
  'You are Heimdall, a scientific assistant for spacecraft fire safety.',
  'Summarize the combustion-science investigation strictly from the JSON provided.',
  'Never invent numbers. If a field is missing, say the data is not available.',
  'Return: objective, fuel, test conditions (O2 %, pressure, gravity), variables, sensors, and key findings.',
].join(' ');

export async function summarizeInvestigation(investigation) {
  const res = await chat([
    { role: 'system', content: SUMMARY_SYSTEM },
    { role: 'user', content: JSON.stringify(investigation, null, 2) },
  ]);
  return {
    summary: res.content,
    status: res.status,
    sessionId: res.sessionId,
    sessionUrl: res.sessionUrl,
    model,
  };
}

const RAG_SYSTEM = [
  'You are Heimdall, a scientific assistant for spacecraft fire safety (NASA PSI investigations).',
  'Do not clone repositories or run shell commands; reply directly in chat.',
  'When NASA PSI context excerpts are provided below, base your technical claims on them and cite the investigation acronym/title.',
  'Never invent experimental numbers. If specific experimental data is not in the context, state that clearly.',
].join(' ');

export async function answerQuestion(question, contextDocs = [], { sessionId } = {}) {
  const context = contextDocs.length
    ? contextDocs
        .map((d, i) => `[${i + 1}] ${d.acronym ?? d.title}\n${d.aiSummary ?? d.objective ?? ''}`)
        .join('\n\n')
    : 'No local MongoDB investigations loaded yet (testing chat connection).';

  const res = await chat(
    [
      { role: 'system', content: RAG_SYSTEM },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` },
    ],
    { sessionId }
  );

  return {
    answer: res.content,
    status: res.status,
    sessionId: res.sessionId,
    sessionUrl: res.sessionUrl,
    sessionStatus: res.sessionStatus,
    baselineCount: res.baselineCount,
    citations: contextDocs.map((d) => ({ id: d._id, title: d.title, acronym: d.acronym })),
    model,
  };
}
