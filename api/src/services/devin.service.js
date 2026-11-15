import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import env from '../config/env.js';
import HttpError from '../utils/http-error.js';
import {
  AGENT_TOOL_DECLARATIONS,
  detailToolResult,
  executeAgentTool,
  formatToolArgs,
  summarizeToolResult,
} from './agent-tools.js';

const { apiKey, apiBase, model } = env.devin;
const gemini = env.gemini ?? {};

const geminiBudget = {
  limit: Math.max(1000, Number(gemini.tokenLimit ?? 120000)),
  usedTokens: 0,
  promptTokens: 0,
  outputTokens: 0,
  requests: 0,
};

export function getGeminiTokenBudget() {
  const remainingTokens = Math.max(0, geminiBudget.limit - geminiBudget.usedTokens);
  const percentUsed =
    geminiBudget.limit > 0
      ? Number(Math.min(100, (geminiBudget.usedTokens / geminiBudget.limit) * 100).toFixed(1))
      : 0;
  const alertLevel =
    percentUsed >= 100
      ? 'exhausted'
      : percentUsed >= 85
        ? 'critical'
        : percentUsed >= 60
          ? 'warning'
          : 'ok';
  return {
    limit: geminiBudget.limit,
    usedTokens: geminiBudget.usedTokens,
    promptTokens: geminiBudget.promptTokens,
    outputTokens: geminiBudget.outputTokens,
    remainingTokens,
    percentUsed,
    requests: geminiBudget.requests,
    alertLevel,
  };
}

function toSlugKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^psi-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildFallbackSummary(doc) {
  if (doc.dataAvailable === false || doc.status === 'upcoming') {
    return `Status: ${doc.status ?? 'upcoming'} (no PSI experimental data published yet). Gravity: ${doc.gravityLevel ?? 'lunar-partial'}.`;
  }
  const c = doc.conditions ?? {};
  const parts = [];
  if (doc.fuel) parts.push(`Fuel: ${doc.fuel}.`);
  if (doc.hardware) parts.push(`Hardware: ${doc.hardware}.`);
  const condParts = [];
  if (c.oxygenPct != null) {
    const range =
      c.oxygenMinPct != null && c.oxygenMaxPct != null && c.oxygenMinPct !== c.oxygenMaxPct
        ? `${c.oxygenMinPct}%-${c.oxygenMaxPct}% (nominal ${c.oxygenPct}%)`
        : `${c.oxygenPct}%`;
    condParts.push(`O2 ${range}`);
  }
  if (c.pressurePsi != null) condParts.push(`Pressure ${c.pressurePsi} psi`);
  if (c.flowVelocity != null) condParts.push(`Flow ${c.flowVelocity} m/s`);
  if (doc.gravityLevel) condParts.push(doc.gravityLevel);
  if (condParts.length) parts.push(`Conditions: ${condParts.join(', ')}.`);
  return parts.join(' ');
}

function loadFallbackDocs() {
  const candidates = [
    path.resolve(import.meta.dirname, '../../../data/processed/psi-investigations.json'),
    path.resolve(import.meta.dirname, '../../data/processed/psi-investigations.json'),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));
  if (!filePath) return [];
  try {
    const processed = JSON.parse(readFileSync(filePath, 'utf8'));
    return processed.map((doc) => {
      const slug = toSlugKey(doc.psiId ?? doc.acronym ?? doc.title);
      return {
        _id: slug,
        studyId: slug,
        psiId: doc.psiId,
        acronym: doc.acronym,
        title: doc.title,
        objective: doc.objective,
        fuel: doc.fuel,
        hardware: doc.hardware,
        category: doc.category,
        gravityLevel: doc.gravityLevel,
        status: doc.status ?? 'published',
        dataAvailable: doc.dataAvailable !== false,
        conditions: doc.conditions ?? {},
        aiSummary: buildFallbackSummary(doc),
      };
    });
  } catch {
    return [];
  }
}

export const PSI_FALLBACK_DOCS = loadFallbackDocs();

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

export function extractCitations(docs = [], answerText = '') {
  const normalizedDocs = (docs.length ? docs : PSI_FALLBACK_DOCS).map((d) => {
    const label = d.acronym ?? d.name ?? d.title ?? 'PSI Study';
    const rawId = String(d.studyId ?? d.id ?? d._id ?? label).toLowerCase();
    const studyId =
      PSI_FALLBACK_DOCS.find(
        (ref) =>
          ref.studyId === rawId ||
          label.toLowerCase().includes(ref.studyId) ||
          label.toLowerCase().includes(ref.acronym.toLowerCase())
      )?.studyId ?? 'saffire-iii';
    return {
      id: d._id ?? studyId,
      studyId,
      label,
      title: d.title ?? label,
      acronym: d.acronym ?? label,
    };
  });

  if (!answerText) return normalizedDocs.slice(0, 2);

  const lower = answerText.toLowerCase();
  const matched = normalizedDocs.filter(
    (c) => lower.includes(c.label.toLowerCase()) || lower.includes(c.studyId)
  );
  return matched.length ? matched : normalizedDocs.slice(0, 2);
}

function parseDevinError(text, fallback) {
  try {
    const parsed = JSON.parse(text);
    const detail = parsed?.detail || parsed?.message || fallback;
    const code = parsed?.error_code ? ` (${parsed.error_code})` : '';
    return { message: `${detail}${code}`, errorCode: parsed?.error_code ?? null };
  } catch {
    return { message: text || fallback, errorCode: null };
  }
}

export async function getDevinAccountStatus() {
  if (gemini.apiKey) {
    const res = await fetch(
      `${gemini.apiBase}/v1beta/models/${encodeURIComponent(gemini.model)}?key=${encodeURIComponent(gemini.apiKey)}`
    ).catch(() => null);
    if (!res || !res.ok) {
      return {
        connected: false,
        provider: 'gemini',
        model: gemini.model,
        quotaStatus: res ? `error_${res.status}` : 'offline',
      };
    }
    const info = await res.json().catch(() => ({}));
    return {
      connected: true,
      provider: 'gemini',
      model: gemini.model,
      displayName: info.displayName ?? 'Gemini',
      inputTokenLimit: info.inputTokenLimit ?? null,
      outputTokenLimit: info.outputTokenLimit ?? null,
      tokenBudget: getGeminiTokenBudget(),
      quotaStatus: getGeminiTokenBudget().alertLevel === 'exhausted' ? 'budget_exhausted' : 'connected',
    };
  }
  if (!apiKey) {
    return {
      connected: false,
      model,
      sessionsUsed: null,
      activeSessions: null,
      quotaStatus: 'unconfigured',
    };
  }
  const res = await fetch(`${apiBase}/v1/sessions?limit=100`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    const { message, errorCode } = parseDevinError(text, `HTTP ${res.status}`);
    return {
      connected: false,
      model,
      sessionsUsed: null,
      activeSessions: null,
      quotaStatus: errorCode ?? `error_${res.status}`,
      detail: message,
    };
  }
  const data = await res.json();
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const activeSessions = sessions.filter((s) =>
    ['working', 'running', 'claiming', 'resuming'].includes(
      String(s.status_enum ?? s.status ?? '').toLowerCase()
    )
  ).length;
  return {
    connected: true,
    model,
    sessionsUsed: sessions.length,
    activeSessions,
    quotaStatus: 'connected',
  };
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
    devinMode: data.devin_mode ?? model,
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
      const { message, errorCode } = parseDevinError(text, `HTTP ${createRes.status}`);
      throw new HttpError(502, `Devin session creation error ${createRes.status}: ${message}`, {
        body: text,
        errorCode,
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

const MAX_TOOL_ROUNDS = 6;

function geminiUrl(method, extra = '') {
  return `${gemini.apiBase}/v1beta/models/${encodeURIComponent(gemini.model)}:${method}?key=${encodeURIComponent(gemini.apiKey)}${extra}`;
}

async function geminiError(res) {
  const text = await res.text();
  let msg = `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(text);
    msg = parsed?.error?.message ?? msg;
  } catch {
    if (text) msg = text;
  }
  const status = res.status === 503 || res.status === 429 ? res.status : 502;
  throw new HttpError(status, `Gemini API error ${res.status}: ${msg}`, { body: text });
}

/**
 * One Gemini round. When `onText` is provided it streams via
 * streamGenerateContent (SSE) and forwards each text delta live.
 * Returns complete content parts + usage for the round.
 */
async function callGeminiRound({ systemText, contents, temperature, tools, onText }) {
  const res = await fetch(geminiUrl(onText ? 'streamGenerateContent' : 'generateContent', onText ? '&alt=sse' : ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
      ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
      generationConfig: {
        temperature,
        maxOutputTokens: Math.max(128, Number(gemini.maxOutputTokens ?? 1024)),
      },
    }),
  });

  if (!res.ok) await geminiError(res);

  if (!onText) {
    const data = await res.json();
    return {
      parts: data.candidates?.[0]?.content?.parts ?? [],
      usage: data.usageMetadata ?? null,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const otherParts = [];
  let usage = null;

  const handlePayload = (data) => {
    if (data?.error) {
      throw new HttpError(
        data.error.code === 503 || data.error.code === 429 ? data.error.code : 502,
        `Gemini API error ${data.error.code}: ${data.error.message ?? 'stream error'}`
      );
    }
    if (data?.usageMetadata) usage = data.usageMetadata;
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part.text === 'string' && part.text.length > 0) {
        text += part.text;
        onText(part.text);
      } else if (part.functionCall) {
        otherParts.push(part);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Gemini may use CRLF line endings — normalize before splitting blocks.
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const rawData = block.match(/^data: ([\s\S]+)$/m)?.[1];
      if (!rawData || rawData.trim() === '[DONE]') continue;
      try {
        handlePayload(JSON.parse(rawData));
      } catch (err) {
        if (err instanceof HttpError) throw err;
        // ignore malformed SSE chunks
      }
    }
  }

  return {
    parts: [...(text ? [{ text }] : []), ...otherParts],
    usage,
  };
}

async function chatWithGemini(
  messages,
  { temperature = 0.2, useTools = false, onEvent = null } = {}
) {
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const toolCalls = [];
  const usageTotals = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  let rounds = 0;
  let content = '';

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    if (geminiBudget.usedTokens >= geminiBudget.limit) {
      throw new HttpError(
        429,
        `Gemini API token budget limit reached (${geminiBudget.usedTokens.toLocaleString()}/${geminiBudget.limit.toLocaleString()} tokens).`
      );
    }

    const { parts, usage } = await callGeminiRound({
      systemText,
      contents,
      temperature,
      // On the last allowed round drop the tools so the model must answer.
      tools: useTools && round < MAX_TOOL_ROUNDS ? AGENT_TOOL_DECLARATIONS : null,
      onText: onEvent ? (chunk) => onEvent({ type: 'delta', text: chunk }) : null,
    });

    if (usage) {
      usageTotals.promptTokenCount += Number(usage.promptTokenCount ?? 0);
      usageTotals.candidatesTokenCount += Number(usage.candidatesTokenCount ?? 0);
      usageTotals.totalTokenCount += Number(
        usage.totalTokenCount ??
          Number(usage.promptTokenCount ?? 0) + Number(usage.candidatesTokenCount ?? 0)
      );
    }

    const functionCalls = useTools ? parts.filter((p) => p.functionCall) : [];

    if (functionCalls.length === 0 || round === MAX_TOOL_ROUNDS) {
      content = (content + parts.map((p) => p.text ?? '').join('')).trim();
      rounds = round;
      break;
    }

    content += parts.map((p) => p.text ?? '').join('');
    contents.push({ role: 'model', parts });
    const responseParts = [];
    for (const part of functionCalls) {
      const { name, args } = part.functionCall;
      const argsLabel = formatToolArgs(name, args ?? {});
      onEvent?.({ type: 'tool_call', name, argsLabel });
      const result = await executeAgentTool(name, args ?? {});
      const summary = summarizeToolResult(name, result);
      const detail = detailToolResult(name, result);
      const ok = result?.error == null;
      toolCalls.push({ name, argsLabel, summary, detail, ok });
      onEvent?.({ type: 'tool_result', name, ok, summary, detail });
      responseParts.push({
        functionResponse: { name, response: { content: result } },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  if (usageTotals.totalTokenCount > 0) {
    geminiBudget.promptTokens += usageTotals.promptTokenCount;
    geminiBudget.outputTokens += usageTotals.candidatesTokenCount;
    geminiBudget.usedTokens += usageTotals.totalTokenCount;
    geminiBudget.requests += 1;
  }

  return {
    content,
    status: 'completed',
    sessionId: null,
    sessionUrl: null,
    sessionStatus: 'completed',
    baselineCount: 0,
    usage: usageTotals.totalTokenCount > 0 ? usageTotals : null,
    tokenBudget: getGeminiTokenBudget(),
    model: gemini.model,
    provider: 'gemini',
    toolCalls,
    toolRounds: rounds,
  };
}

/**
 * AI client — uses Google AI Studio (Gemini) when GEMINI_API_KEY is set,
 * otherwise falls back to Devin API.
 */
async function chat(
  messages,
  { temperature = 0.2, sessionId, waitMs, useTools = false, onEvent = null } = {}
) {
  if (gemini.apiKey) {
    return chatWithGemini(messages, { temperature, useTools, onEvent });
  }

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

function hasAiProviderConfigured() {
  return Boolean(gemini.apiKey || apiKey);
}

function buildStructuredOfflineBrief(inv, audience = 'Engineer') {
  if (!inv) return 'No PSI investigation metadata available.';
  const isUpcoming = inv.dataAvailable === false || inv.status === 'upcoming';
  if (isUpcoming) {
    return `${inv.acronym ?? inv.title} is an upcoming (${inv.gravityLevel ?? 'lunar-partial'}) mission placeholder with NO PSI experimental data published yet. Planned objective: ${inv.objective ?? 'Not reported.'}`;
  }
  const c = inv.conditions ?? {};
  const o2 =
    c.oxygenMinPct != null && c.oxygenMaxPct != null && c.oxygenMinPct !== c.oxygenMaxPct
      ? `${c.oxygenMinPct}%-${c.oxygenMaxPct}% (nominal ${c.oxygenPct ?? c.oxygenMaxPct}%)`
      : c.oxygenPct != null
        ? `${c.oxygenPct}%`
        : 'not reported';
  const pressure = c.pressurePsi != null ? `${c.pressurePsi} psi` : 'not reported';
  const flow = c.flowVelocity != null ? `${c.flowVelocity} m/s` : 'quiescent / not reported';

  if (audience === 'Student') {
    const earthNote = inv.earthApplications?.length
      ? ` On Earth, this informs: ${inv.earthApplications[0]}.`
      : '';
    return `${inv.acronym} (${inv.title}) studies ${inv.fuel ?? 'spacecraft fuels'} in ${inv.gravityLevel ?? 'microgravity'} (${o2} O2, ${pressure}). Objective: ${inv.objective ?? 'Not reported.'}${earthNote}`;
  }

  return [
    `${inv.acronym} [${inv.psiId ?? 'PSI'}] — ${inv.title}.`,
    `Hardware: ${inv.hardware ?? 'Not reported'} | Fuel: ${inv.fuel ?? 'Not reported'}.`,
    `Verified conditions: O2 ${o2}, Pressure ${pressure}, Flow ${flow}, Gravity ${inv.gravityLevel ?? 'microgravity'}.`,
    `Variables: ${inv.variables?.length ? inv.variables.join(', ') : 'Not reported'}.`,
    `Sensors: ${inv.sensors?.length ? inv.sensors.join(', ') : 'Not reported'}.`,
  ].join(' ');
}

function selectRelevantFallbackDocs(docs, question, limit = 3) {
  const tokens = String(question ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (!tokens.length) return docs.slice(0, limit);

  const scored = docs.map((d) => {
    const hay = `${d.acronym ?? ''} ${d.title ?? ''} ${d.objective ?? ''} ${d.fuel ?? ''} ${d.hardware ?? ''} ${d.aiSummary ?? ''}`.toLowerCase();
    const hits = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
    return { d, hits };
  });
  const matched = scored.filter((item) => item.hits > 0).sort((a, b) => b.hits - a.hits);
  return (matched.length ? matched : scored).slice(0, limit).map((item) => item.d);
}

export async function summarizeInvestigation(investigation, { audience = 'Engineer' } = {}) {
  if (!hasAiProviderConfigured()) {
    return {
      summary: buildStructuredOfflineBrief(investigation, audience),
      unavailable: true,
      status: 'unavailable',
      reason: 'LLM key not configured offline; showing verified PSI record brief.',
      sessionId: null,
      sessionUrl: null,
      provider: 'offline',
      model: null,
    };
  }
  const audienceInstruction =
    audience === 'Student'
      ? 'Audience: Student — explain clearly in plain language while preserving all exact PSI numbers.'
      : 'Audience: Aerospace Fire Safety Engineer — highlight O2%, pressure, flow regime, variables, and sensors.';
  const res = await chat([
    { role: 'system', content: `${SUMMARY_SYSTEM} ${audienceInstruction}` },
    { role: 'user', content: JSON.stringify(investigation, null, 2) },
  ]);
  return {
    summary: res.content,
    status: res.status,
    sessionId: res.sessionId,
    sessionUrl: res.sessionUrl,
    provider: res.provider ?? (gemini.apiKey ? 'gemini' : 'devin'),
    model: res.model ?? model,
  };
}

const RAG_SYSTEM = [
  'You are Heimdall AI Copilot powered by Gemini, a scientific assistant for NASA PSI spacecraft fire safety investigations.',
  'You have READ-ONLY access to the live MongoDB `heimdall` database snapshot provided below (you can read and summarize collections, counts, investigations, experiments, and scenarios, but NEVER modify or write to the database).',
  'Use ONLY the provided MongoDB read-only snapshot and NASA PSI context excerpts below. Cite study acronyms or slugs (e.g. Saffire-III, BASS-II, ACME, FLEX-2, SAME) and exact database counts when summarizing MongoDB.',
  'Never invent experimental numbers or database records. If a requested measurement is missing, state that explicitly.',
].join(' ');

const AGENT_SYSTEM = [
  'You have tools that query the live system: search_investigations and get_investigation read the real PSI catalog, rank_investigations runs the transparent scoring engine, predict_burn_duration calls the FireHazR KNN model, list_mission_scenarios returns habitat presets.',
  'For ANY numeric answer — test conditions, O2 %, pressure, burn durations, ranking scores — you MUST call the relevant tool instead of recalling values.',
  'If a tool returns an error or a coverage abstention, report it verbatim and never substitute your own estimate.',
  'When you rank, briefly explain the top factor contributions from the returned breakdown.',
].join(' ');

export async function answerQuestion(
  question,
  contextDocs = [],
  { sessionId, audience = 'Engineer', scenario = null, mongoContext = null, onEvent = null } = {}
) {
  const activeDocs = contextDocs.length ? contextDocs : PSI_FALLBACK_DOCS;
  if (!hasAiProviderConfigured()) {
    const matchedDocs = selectRelevantFallbackDocs(activeDocs, question, 3);
    const excerpts = matchedDocs
      .map(
        (d) =>
          `• ${d.acronym ?? d.title} (${d.psiId ?? d.studyId}): ${d.aiSummary || d.objective || 'Verified PSI record.'}`
      )
      .join('\n');
    return {
      answer: [
        `[Offline Verified PSI Excerpts — LLM key unavailable]`,
        scenario
          ? `Active scenario: ${scenario.label ?? scenario.id} (${scenario.oxygenPct ?? 21}% O2, ${scenario.pressurePsi ?? 14.7} psi).`
          : null,
        excerpts,
      ]
        .filter(Boolean)
        .join('\n'),
      status: 'unavailable',
      unavailable: true,
      sessionId: null,
      sessionUrl: null,
      sessionStatus: 'unavailable',
      baselineCount: 0,
      citations: extractCitations(matchedDocs, `${question} ${excerpts}`),
      model: null,
      provider: 'offline',
      usage: null,
      tokenBudget: null,
    };
  }
  const context = activeDocs
    .map(
      (d, i) =>
        `[${i + 1}] ${d.acronym ?? d.name ?? d.title}: ${d.title ?? d.family ?? ''}\nObjective: ${d.objective ?? ''}\nDetails: ${d.aiSummary ?? ''}`
    )
    .join('\n\n');

  const mongoNote = mongoContext?.connected
    ? `Live MongoDB Read-Only Snapshot (db: ${mongoContext.database}):\n${JSON.stringify(
        {
          collections: mongoContext.collections,
          investigations: mongoContext.investigations,
          experimentSummaryByStudy: mongoContext.experimentSummary,
          scenarios: mongoContext.scenarios,
          ...(mongoContext.matchedExperiments?.length
            ? { matchedExperiments: mongoContext.matchedExperiments }
            : {}),
        },
        null,
        2
      )}`
    : 'MongoDB Status: Not connected (offline).';

  const scenarioNote = scenario
    ? `Active Mission Scenario: ${scenario.label ?? scenario.id} (Gravity: ${scenario.gravity ?? '0g'}, O2: ${scenario.oxygenPct ?? 21}%, Pressure: ${scenario.pressurePsi ?? 14.7} psi).`
    : '';
  const audienceNote =
    audience === 'Student'
      ? 'Audience: Student (explain clearly in accessible terms while keeping real numbers accurate).'
      : 'Audience: Spacecraft Fire Safety Engineer (be technical, concise, and cite O2 %, pressure, and flow regimes).';

  const res = await chat(
    [
      {
        role: 'system',
        content: `${RAG_SYSTEM}${gemini.apiKey ? ` ${AGENT_SYSTEM}` : ''} ${audienceNote}`,
      },
      {
        role: 'user',
        content: `${scenarioNote ? `${scenarioNote}\n\n` : ''}${mongoNote}\n\nNASA PSI Context:\n${context}\n\nUser Question: ${question}`,
      },
    ],
    { sessionId, useTools: true, onEvent }
  );

  return {
    answer: res.content,
    status: res.status,
    sessionId: res.sessionId,
    sessionUrl: res.sessionUrl,
    sessionStatus: res.sessionStatus,
    baselineCount: res.baselineCount,
    citations: extractCitations(activeDocs, res.content ?? question),
    model: res.model ?? model,
    provider: res.provider ?? (gemini.apiKey ? 'gemini' : 'devin'),
    usage: res.usage ?? null,
    tokenBudget: res.tokenBudget ?? (gemini.apiKey ? getGeminiTokenBudget() : null),
    toolCalls: res.toolCalls ?? [],
  };
}

export async function interpretFirehazrResult({ conditions, result, study = null }) {
  if (!hasAiProviderConfigured()) {
    return {
      interpretation: null,
      unavailable: true,
      reason: 'AI provider not configured on the server — set GEMINI_API_KEY or DEVIN_API_KEY to enable interpretations.',
      model: null,
      provider: 'offline',
      usage: null,
      tokenBudget: null,
    };
  }
  const system = [
    'You are a NASA spacecraft fire safety specialist explaining a FireHazR (KNN FLEX v3) droplet-burn test result.',
    'Write two short, clear sections in plain text (no markdown headers needed, use **bold** sparingly):',
    '1) Technical interpretation (2-3 sentences): explain what the returned burn duration (or abstention reason) means given the fuel, pressure (mmHg), droplet diameter (mm), O2 fraction, and any CO2/He diluent, citing exact numbers from the JSON.',
    '2) Mission relevance (1-2 sentences): connect this condition to NASA PSI research (FLEX/FLEX-2 suppression, Moon/Mars elevated-O2 habitats, or EVA safety).',
    'STRICT RULE: Never invent numbers or claim fire probability/safety ratings. Only cite numbers present in the JSON.',
  ].join(' ');

  const res = await chat([
    { role: 'system', content: system },
    {
      role: 'user',
      content: JSON.stringify({ conditions, result, linkedPsiStudy: study }, null, 2),
    },
  ]);

  return {
    interpretation: res.content,
    model: res.model ?? model,
    provider: res.provider ?? (gemini.apiKey ? 'gemini' : 'devin'),
    usage: res.usage ?? null,
    tokenBudget: res.tokenBudget ?? (gemini.apiKey ? getGeminiTokenBudget() : null),
  };
}
