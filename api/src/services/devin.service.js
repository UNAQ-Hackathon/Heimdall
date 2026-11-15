import env from '../config/env.js';
import HttpError from '../utils/http-error.js';

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

export const PSI_FALLBACK_DOCS = [
  {
    _id: 'saffire-iii',
    studyId: 'saffire-iii',
    acronym: 'Saffire-III',
    title: 'Spacecraft Fire Experiment - III',
    objective:
      'Characterize large-scale concurrent flame spread rate and steady burning limits over a 0.4 m x 1.0 m cotton-fiberglass panel at forced ventilation flow speeds inside Cygnus OA-5.',
    aiSummary:
      'Fuel: SIBAL composite fabric sheet (0.4 x 1.0 m). Hardware: Saffire flow duct in Cygnus OA-5. Conditions: O2 21.0%, Pressure 14.7 psi, Flow 0.20 to 0.30 m/s, microgravity.',
  },
  {
    _id: 'bass-ii',
    studyId: 'bass-ii',
    acronym: 'BASS-II',
    title: 'Burning and Suppression of Solids - II',
    objective:
      'Investigate solid-fuel flammability limits, flame spread rates, and radiative/low-flow quenching in microgravity inside the MSG with the SPICE flow duct.',
    aiSummary:
      'Fuel: Solid PMMA slabs/rods, SIBAL cotton-fiberglass, and Nomex fabrics. Hardware: MSG with SPICE flow duct. Conditions: O2 13.5% -> 30.0% (nominal 21%), Pressure 14.7 psi, Forced flow 0.0 to 0.50 m/s, microgravity.',
  },
  {
    _id: 'cfi-g',
    studyId: 'cfi-g',
    acronym: 'CFI-G',
    title: 'ACME: Cool Flames Investigation with Gases',
    objective:
      'Investigate non-premixed spherical gaseous cool flames in microgravity inside CIR/ACME, testing up to 85% O2 supplied from the porous spherical burner.',
    aiSummary:
      'Fuel: Gas (n-butane and methane mixtures from porous spherical burner). Hardware: CIR/ACME (one of 6 ACME gas flame experiments). Conditions: O2 up to 85% from burner, Pressure 14.7 psi, microgravity.',
  },
  {
    _id: 'e-field-flames',
    studyId: 'e-field-flames',
    acronym: 'E-FIELD Flames',
    title: 'ACME: Electric-Field Effects on Laminar Diffusion Flames',
    objective:
      'Apply high-voltage electric fields to laminar gas diffusion flames in CIR/ACME so ion-driven wind acts as an adjustable body-force proxy for partial gravity (lunar/Martian convection).',
    aiSummary:
      'Fuel: Gas (methane and ethylene coflow/jet diffusion flames). Hardware: CIR/ACME. Conditions: O2 21.0%, Pressure 14.7 psi, Flow 0.15 m/s, microgravity with electric-field partial-gravity proxy.',
  },
  {
    _id: 'flex-2',
    studyId: 'flex-2',
    acronym: 'FLEX-2',
    title: 'Flame Extinguishment Experiment - 2',
    objective:
      'Investigate spherical liquid droplet combustion dynamics, radiative extinction, and second-stage cool-flame transitions inside the Multi-user Droplet Combustion Apparatus (MDCA) in the CIR.',
    aiSummary:
      'Fuel: Liquid droplets (n-heptane, n-octane, n-decane, methanol, 1.5 - 4.0 mm). Hardware: CIR/MDCA. Conditions: O2 15.0% -> 30.0%, Pressure 14.7 psi (0.5 - 3.0 atm), microgravity.',
  },
  {
    _id: 'same',
    studyId: 'same',
    acronym: 'SAME',
    title: 'Smoke Aerosol Measurement Experiment',
    objective:
      'Characterization of smoke particle size distributions from overheated spacecraft materials in microgravity (MSG).',
    aiSummary:
      'Fuel: Solid pyrolysis (Kapton wire insulation, Teflon, silicone rubber, cellulose). Hardware: MSG (instrument also used by DAFT/DAFT-2 to measure cabin dust). Conditions: O2 21.0%, Pressure 14.7 psi, Flow 0.05 m/s, microgravity.',
  },
];

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

async function chatWithGemini(messages, { temperature = 0.2 } = {}) {
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

  if (geminiBudget.usedTokens >= geminiBudget.limit) {
    throw new HttpError(
      429,
      `Gemini API token budget limit reached (${geminiBudget.usedTokens.toLocaleString()}/${geminiBudget.limit.toLocaleString()} tokens).`
    );
  }

  const res = await fetch(
    `${gemini.apiBase}/v1beta/models/${encodeURIComponent(gemini.model)}:generateContent?key=${encodeURIComponent(gemini.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: Math.max(128, Number(gemini.maxOutputTokens ?? 1024)),
        },
      }),
    }
  );

  if (!res.ok) {
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

  const data = await res.json();
  const usage = data.usageMetadata ?? null;
  if (usage) {
    const promptTok = Number(usage.promptTokenCount ?? 0);
    const outTok = Number(usage.candidatesTokenCount ?? 0);
    const totalTok = Number(usage.totalTokenCount ?? promptTok + outTok);
    geminiBudget.promptTokens += promptTok;
    geminiBudget.outputTokens += outTok;
    geminiBudget.usedTokens += totalTok;
    geminiBudget.requests += 1;
  }

  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim() ?? '';

  return {
    content,
    status: 'completed',
    sessionId: null,
    sessionUrl: null,
    sessionStatus: 'completed',
    baselineCount: 0,
    usage,
    tokenBudget: getGeminiTokenBudget(),
    model: gemini.model,
    provider: 'gemini',
  };
}

/**
 * AI client — uses Google AI Studio (Gemini) when GEMINI_API_KEY is set,
 * otherwise falls back to Devin API.
 */
async function chat(messages, { temperature = 0.2, sessionId, waitMs } = {}) {
  if (gemini.apiKey) {
    return chatWithGemini(messages, { temperature });
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
  'You are Heimdall AI Copilot powered by Gemini, a scientific assistant for NASA PSI spacecraft fire safety investigations.',
  'You have READ-ONLY access to the live MongoDB `heimdall` database snapshot provided below (you can read and summarize collections, counts, investigations, experiments, and scenarios, but NEVER modify or write to the database).',
  'Use ONLY the provided MongoDB read-only snapshot and NASA PSI context excerpts below. Cite study acronyms or slugs (e.g. Saffire-III, BASS-II, ACME, FLEX-2, SAME) and exact database counts when summarizing MongoDB.',
  'Never invent experimental numbers or database records. If a requested measurement is missing, state that explicitly.',
].join(' ');

export async function answerQuestion(
  question,
  contextDocs = [],
  { sessionId, audience = 'Engineer', scenario = null, mongoContext = null } = {}
) {
  const activeDocs = contextDocs.length ? contextDocs : PSI_FALLBACK_DOCS;
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
      { role: 'system', content: `${RAG_SYSTEM} ${audienceNote}` },
      {
        role: 'user',
        content: `${scenarioNote ? `${scenarioNote}\n\n` : ''}${mongoNote}\n\nNASA PSI Context:\n${context}\n\nUser Question: ${question}`,
      },
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
    citations: extractCitations(activeDocs, res.content ?? question),
    model: res.model ?? model,
    provider: res.provider ?? (gemini.apiKey ? 'gemini' : 'devin'),
    usage: res.usage ?? null,
    tokenBudget: res.tokenBudget ?? (gemini.apiKey ? getGeminiTokenBudget() : null),
  };
}

export async function interpretFirehazrResult({ conditions, result, study = null }) {
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
