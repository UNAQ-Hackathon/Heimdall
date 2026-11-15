import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_TOOL_DECLARATIONS,
  detailToolResult,
  executeAgentTool,
  formatToolArgs,
  MISSION_SCENARIOS,
  summarizeToolResult,
} from '../src/services/agent-tools.js';

test('tool declarations match implemented executors', () => {
  const names = AGENT_TOOL_DECLARATIONS.map((t) => t.name);
  assert.deepEqual(names, [
    'search_investigations',
    'get_investigation',
    'rank_investigations',
    'predict_burn_duration',
    'list_mission_scenarios',
  ]);
  for (const decl of AGENT_TOOL_DECLARATIONS) {
    assert.equal(decl.parameters.type, 'object');
    assert.ok(decl.description.length > 20);
  }
});

test('search_investigations finds studies by keyword and filters', async () => {
  const res = await executeAgentTool('search_investigations', { query: 'bass' });
  assert.ok(res.total >= 2);
  assert.ok(res.investigations.some((d) => d.acronym === 'BASS'));
  assert.ok(res.investigations.some((d) => d.acronym === 'BASS-II'));

  const detection = await executeAgentTool('search_investigations', {
    category: 'detection',
    dataAvailable: true,
  });
  assert.ok(detection.investigations.every((d) => d.category === 'detection'));
  assert.ok(!detection.investigations.some((d) => d.acronym === 'LUCI'));
});

test('get_investigation returns full detail and real series stats', async () => {
  const flex = await executeAgentTool('get_investigation', { acronym: 'FLEX' });
  assert.equal(flex.acronym, 'FLEX');
  assert.ok(flex.objective.length > 10);
  const totalSamples = flex.series.reduce((n, s) => n + s.samples, 0);
  assert.equal(totalSamples, 260);
  assert.ok(flex.series[0].yRange.max > flex.series[0].yRange.min);
  assert.ok(flex.seriesSource.includes('PSI-69'));

  const missing = await executeAgentTool('get_investigation', { acronym: 'NOPE-9' });
  assert.ok(missing.error);
});

test('rank_investigations returns transparent breakdown for the Moon base scenario', async () => {
  const moon = MISSION_SCENARIOS.find((s) => s.id === 'moon');
  const res = await executeAgentTool('rank_investigations', { ...moon, limit: 5 });
  assert.equal(res.ranking.length, 5);
  assert.ok(res.ranking[0].score >= res.ranking[1].score);
  assert.equal(res.ranking[0].breakdown.length, 4);
  assert.ok(!res.ranking.some((r) => r.acronym === 'LUCI' && r.score > 0));
});

test('predict_burn_duration never throws and never invents a result', async () => {
  const res = await executeAgentTool('predict_burn_duration', {
    fuel: 'Heptane',
    pressure_mmhg: 760,
    diameter_mm: 2.0,
    o2_fraction: 0.21,
    n2_fraction: 0.79,
    co2_fraction: 0,
    he_fraction: 0,
  });
  // Analytics may be offline in test runs: either a real model response or an
  // honest error — never a fabricated number.
  assert.ok(res.prediction != null || typeof res.error === 'string');
  if (res.prediction) {
    assert.equal(res.conditions.fuel, 'Heptane');
  }
});

test('unknown tools return an error instead of throwing', async () => {
  const res = await executeAgentTool('hack_the_planet', {});
  assert.match(res.error, /Unknown tool/);
});

test('formatToolArgs renders only meaningful args', () => {
  assert.equal(
    formatToolArgs('rank_investigations', {
      gravity: 'lunar',
      oxygenPct: 30,
      pressurePsi: 10.2,
      category: 'all',
    }),
    'lunar, 30% O2, 10.2 psi'
  );
  assert.equal(
    formatToolArgs('predict_burn_duration', {
      fuel: 'Heptane',
      diameter_mm: 2,
      pressure_mmhg: 760,
      o2_fraction: 0.21,
    }),
    'Heptane, 2 mm, 760 mmHg'
  );
  assert.equal(formatToolArgs('search_investigations', { query: 'oxygen' }), '"oxygen"');
});

test('summarizeToolResult condenses real results and surfaces errors', async () => {
  const rank = await executeAgentTool('rank_investigations', {
    gravity: 'lunar',
    oxygenPct: 30,
    pressurePsi: 10.2,
    limit: 3,
  });
  assert.match(summarizeToolResult('rank_investigations', rank), /^top: \S+ 0\.\d+$/);

  const flex = await executeAgentTool('get_investigation', { acronym: 'FLEX' });
  assert.equal(summarizeToolResult('get_investigation', flex), 'FLEX · 260 data pts');

  assert.match(
    summarizeToolResult('get_investigation', { error: 'not found' }),
    /^error: not found/
  );
});

test('detailToolResult exposes real data previews for the trace', async () => {
  const rank = await executeAgentTool('rank_investigations', {
    gravity: 'lunar',
    oxygenPct: 30,
    pressurePsi: 10.2,
    limit: 3,
  });
  const lines = detailToolResult('rank_investigations', rank);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^1\. \S+ — 0\.\d+$/);

  const flex = await executeAgentTool('get_investigation', { acronym: 'FLEX' });
  assert.ok(detailToolResult('get_investigation', flex).some((l) => l.includes('260')));

  assert.deepEqual(detailToolResult('get_investigation', { error: 'x' }), []);
});
