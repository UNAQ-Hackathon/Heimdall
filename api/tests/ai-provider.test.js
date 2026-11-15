import assert from 'node:assert/strict';
import { test } from 'node:test';
import env from '../src/config/env.js';
import {
  answerQuestion,
  getDevinAccountStatus,
  getTokenBudget,
  interpretFirehazrResult,
  resolveAiProviders,
} from '../src/services/devin.service.js';

/**
 * env.js loads real keys from api/.env — these tests patch the (mutable) env
 * objects so provider resolution is deterministic, then restore them.
 */
function patchEnv(t, { provider, geminiKey, openaiKey, devinKey }) {
  const saved = {
    provider: env.ai.provider,
    geminiKey: env.gemini.apiKey,
    openaiKey: env.openaiCompat.apiKey,
    devinKey: env.devin.apiKey,
  };
  if (provider !== undefined) env.ai.provider = provider;
  if (geminiKey !== undefined) env.gemini.apiKey = geminiKey;
  if (openaiKey !== undefined) env.openaiCompat.apiKey = openaiKey;
  if (devinKey !== undefined) env.devin.apiKey = devinKey;
  t.after(() => {
    env.ai.provider = saved.provider;
    env.gemini.apiKey = saved.geminiKey;
    env.openaiCompat.apiKey = saved.openaiKey;
    env.devin.apiKey = saved.devinKey;
  });
}

const ALL_KEYS = { geminiKey: 'g', openaiKey: 'o', devinKey: 'd' };

test('resolveAiProviders auto orders gemini → openai → devin', (t) => {
  patchEnv(t, { provider: 'auto', ...ALL_KEYS });
  assert.deepEqual(resolveAiProviders(), ['gemini', 'openai', 'devin']);
});

test('resolveAiProviders skips unconfigured providers', (t) => {
  patchEnv(t, { provider: 'auto', geminiKey: '', openaiKey: 'o', devinKey: '' });
  assert.deepEqual(resolveAiProviders(), ['openai']);
});

test('AI_PROVIDER forces a single provider (with aliases)', (t) => {
  patchEnv(t, { provider: 'groq', ...ALL_KEYS });
  assert.deepEqual(resolveAiProviders(), ['openai']);
  patchEnv(t, { provider: 'openai', geminiKey: 'g', openaiKey: '', devinKey: 'd' });
  assert.deepEqual(resolveAiProviders(), []);
});

test('openai path maps chat.completions usage and honors interpret cap', async (t) => {
  patchEnv(t, { provider: 'openai', geminiKey: '', openaiKey: 'k', devinKey: '' });
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, opts) => {
    bodies.push(JSON.parse(opts.body));
    return Response.json({
      choices: [{ message: { role: 'assistant', content: 'ok' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  });

  const res = await interpretFirehazrResult({
    conditions: { fuel: 'Methanol' },
    result: { aceptado: true, duracion_estimada_s: 5.1, vecinos: [{}, {}, {}, {}, {}] },
  });

  assert.equal(res.provider, 'openai');
  assert.equal(res.providerLabel, 'Groq');
  assert.equal(res.interpretation, 'ok');
  assert.equal(res.usage.totalTokenCount, 15);
  assert.equal(res.tokenBudget.provider, 'openai');
  // Dedicated interpret cap wins over the provider default
  assert.equal(bodies[0].max_tokens, env.ai.interpretMaxTokens);
  // Neighbors are trimmed to top 3 to save prompt tokens
  const userMsg = bodies[0].messages.find((m) => m.role === 'user');
  assert.equal(JSON.parse(userMsg.content).result.vecinos.length, 3);
});

test('openai agentic loop executes tool calls and answers', async (t) => {
  patchEnv(t, { provider: 'openai', geminiKey: '', openaiKey: 'k', devinKey: '' });
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, opts) => {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    if (bodies.length === 1) {
      return Response.json({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'list_mission_scenarios', arguments: '{}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      });
    }
    const toolMsg = body.messages.find((m) => m.role === 'tool');
    assert.ok(toolMsg, 'second round must include the tool result message');
    assert.equal(toolMsg.tool_call_id, 'call_1');
    return Response.json({
      choices: [{ message: { role: 'assistant', content: '5 scenarios' } }],
      usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 },
    });
  });

  const res = await answerQuestion('list the habitat scenarios', [], {});

  assert.equal(res.provider, 'openai');
  assert.equal(res.answer, '5 scenarios');
  assert.equal(res.toolCalls.length, 1);
  assert.equal(res.toolCalls[0].name, 'list_mission_scenarios');
  assert.equal(res.toolCalls[0].ok, true);
  // tools sent in OpenAI format on the first round
  assert.equal(bodies[0].tools[0].type, 'function');
  assert.equal(bodies[0].tools[0].function.name, 'search_investigations');
});

test('auto fails over from a 429 provider to the next configured one', async (t) => {
  patchEnv(t, { provider: 'auto', geminiKey: 'g', openaiKey: 'o', devinKey: '' });
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    urls.push(String(url));
    if (String(url).includes('generativelanguage')) {
      return Response.json({ error: { message: 'quota exceeded' } }, { status: 429 });
    }
    return Response.json({
      choices: [{ message: { role: 'assistant', content: 'fallback ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  });

  const res = await interpretFirehazrResult({
    conditions: { fuel: 'Heptane' },
    result: { aceptado: true, duracion_estimada_s: 4.2 },
  });

  assert.equal(res.provider, 'openai');
  assert.equal(res.interpretation, 'fallback ok');
  assert.equal(urls.filter((u) => u.includes('generativelanguage')).length, 1);
  assert.equal(urls.filter((u) => u.includes('chat/completions')).length, 1);
});

test('chat status reports the openai provider and its budget', async (t) => {
  patchEnv(t, { provider: 'openai', geminiKey: 'g', openaiKey: 'k', devinKey: '' });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: [] }));
  const status = await getDevinAccountStatus();
  assert.equal(status.provider, 'openai');
  assert.equal(status.providerLabel, 'Groq');
  assert.equal(status.model, env.openaiCompat.model);
  assert.equal(status.connected, true);
  assert.equal(status.tokenBudget.provider, 'openai');
});

test('getTokenBudget reports per-provider budgets', () => {
  const gem = getTokenBudget('gemini');
  const oai = getTokenBudget('openai');
  assert.equal(gem.provider, 'gemini');
  assert.equal(oai.provider, 'openai');
  assert.ok(gem.limit >= 1000 && oai.limit >= 1000);
});
