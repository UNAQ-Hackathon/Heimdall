import env from '../config/env.js';
import HttpError from '../utils/http-error.js';

const { apiKey, apiBase, model } = env.devin;

export const PSI_FALLBACK_DOCS = [
  {
    _id: 'saffire-iii',
    studyId: 'saffire-iii',
    acronym: 'Saffire-III',
    title: 'Large-Scale Microgravity Flammability & Oxygen Limits',
    objective:
      'Axial forced convection flow duct combustion inside uncrewed Cygnus OA-5 Pressurized Cargo Module.',
    aiSummary:
      'Fuel: PMMA Solid Sheet (0.4 x 1.0 m). Conditions: O2 21.0% -> 34.0%, Pressure 10.2 psi (70.0 kPa), Flow 0.05 to 0.20 m/s, 0g. Findings: Upward combustion transition occurs at 28.4% O2; flame front velocity increases non-linearly with concurrent ventilation (L_inf: 0.24 m/s).',
  },
  {
    _id: 'bass-ii',
    studyId: 'bass-ii',
    acronym: 'BASS-II',
    title: 'Solid Fuel Extinction & Flame Quenching',
    objective:
      'Validated extinction limits for Nomex and Kapton textiles in quiescent low-convection habitable cabins (ISS MSG Glovebox).',
    aiSummary:
      'Fuel: Nomex / Kapton Fabrics & wire insulation. Conditions: O2 56.0% -> 21.0%, Pressure 14.7 psi (101.3 kPa), Quiescent / low forced flow, 0g. Findings: Radiative flame extinction limits with critical forced ventilation threshold at O2G min.',
  },
  {
    _id: 'acme',
    studyId: 'acme',
    acronym: 'ACME',
    title: 'Gas Flame Diffusion & Soot Dynamics',
    objective:
      'Soot-free spherical flame behavior models provide baseline bounds for oxygen-enriched lunar modules (CIRT Chamber).',
    aiSummary:
      'Fuel: Alkane / Heptane droplets (1.5 - 3.0 mm). Conditions: O2 15.0% -> 40.0%, Pressure 14.7 psi, 0g. Findings: Soot-free diffusion-dominated spherical flames and cool flame kinetics.',
  },
  {
    _id: 'flex-2',
    studyId: 'flex-2',
    acronym: 'FLEX-2',
    title: 'Multi-Laser Droplet Combustion Chamber (MDC)',
    objective:
      'Droplet flame dynamics and extinction limits in reduced gravity environments.',
    aiSummary:
      'Fuel: Alkane / Heptane droplets (1.5 - 3.0 mm). Conditions: O2 18.0% -> 30.0%, Pressure 14.7 psi (1.0 - 3.0 atm), 0g. Findings: Critical second-stage low-temperature cool-flame behavior with extended residence times.',
  },
  {
    _id: 'same',
    studyId: 'same',
    acronym: 'SAME',
    title: 'Smoke Aerosol Measurement Experiment',
    objective:
      'Characterization of smoke particle size distributions from spacecraft-relevant materials in microgravity (MSG Module).',
    aiSummary:
      'Fuel: Wire insulation / Kapton. Conditions: O2 21.0%, Pressure 14.7 psi (101.3 kPa), Quiescent, 0g. Findings: Smoke particle distributions differ significantly from 1g baselines, with larger particle mean diameter informing ECLSS smoke detector calibration.',
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
  'You are Heimdall AI Copilot, a scientific assistant for NASA PSI spacecraft fire safety investigations.',
  'IMPORTANT: Do NOT clone repositories, do NOT browse files, and do NOT run shell commands. Reply immediately and concisely in chat (2-4 sentences).',
  'Use ONLY the provided NASA PSI context excerpts below. Cite the study acronym (e.g. Saffire-III, BASS-II, ACME, FLEX-2, SAME) for every claim.',
  'Never invent experimental numbers. If the context does not contain a requested measurement, state that explicitly.',
].join(' ');

export async function answerQuestion(
  question,
  contextDocs = [],
  { sessionId, audience = 'Engineer', scenario = null } = {}
) {
  const activeDocs = contextDocs.length ? contextDocs : PSI_FALLBACK_DOCS;
  const context = activeDocs
    .map(
      (d, i) =>
        `[${i + 1}] ${d.acronym ?? d.title}: ${d.title ?? ''}\nObjective: ${d.objective ?? ''}\nDetails: ${d.aiSummary ?? ''}`
    )
    .join('\n\n');

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
        content: `${scenarioNote ? `${scenarioNote}\n\n` : ''}NASA PSI Context:\n${context}\n\nUser Question: ${question}`,
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
    model,
  };
}
