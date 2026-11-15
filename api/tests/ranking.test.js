import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app.js';
import { PSI_FALLBACK_DOCS } from '../src/services/devin.service.js';

test('GET /api/health and POST /api/ranking respond deterministically', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');

    const invRes = await fetch(`${baseUrl}/api/investigations`);
    assert.equal(invRes.status, 200);
    const invData = await invRes.json();
    assert.equal(invData.total, 23);
    assert.equal(PSI_FALLBACK_DOCS.length, 23);

    const detailRes = await fetch(`${baseUrl}/api/investigations/acme-cfi-g`);
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    assert.equal(detail.acronym, 'CFI-G');

    const flexDetail = await fetch(`${baseUrl}/api/investigations/flex`).then((r) => r.json());
    const flexPts = flexDetail.series?.reduce((acc, s) => acc + (s.samples?.length ?? 0), 0) ?? 0;
    assert.equal(flexDetail.series.length, 6);
    assert.equal(flexPts, 260);

    const moonScenario = { gravity: 'lunar', oxygenPct: 30, pressurePsi: 10.2, flowVelocity: 0.1 };
    const weights = { atmosphereMatch: 40, gravityMatch: 25, dataRichness: 20, documentation: 15 };

    const r1 = await fetch(`${baseUrl}/api/ranking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: moonScenario, weights }),
    }).then((r) => r.json());

    const r2 = await fetch(`${baseUrl}/api/ranking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: moonScenario, weights }),
    }).then((r) => r.json());

    assert.equal(r1.count, 23);
    assert.deepEqual(r1.results, r2.results);

    const luciRank = r1.results.find((item) => item.investigation.acronym === 'LUCI');
    const fm2Rank = r1.results.find((item) => item.investigation.acronym === 'FM2');
    const sofieRank = r1.results.find((item) => item.investigation.acronym === 'SoFIE');
    assert.ok(luciRank && luciRank.investigation.dataAvailable === false);
    assert.ok(fm2Rank && fm2Rank.investigation.dataAvailable === false);
    assert.ok(sofieRank && sofieRank.investigation.category === 'prevention' && sofieRank.investigation.fuelType === 'solid');
    assert.ok(luciRank.score < sofieRank.score && fm2Rank.score < sofieRank.score);

    const issScenario = { gravity: 'microgravity', oxygenPct: 21, pressurePsi: 14.7, flowVelocity: 0.1 };
    const rIss = await fetch(`${baseUrl}/api/ranking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: issScenario, weights }),
    }).then((r) => r.json());

    assert.notDeepEqual(
      r1.results.map((x) => x.investigation.psiId),
      rIss.results.map((x) => x.investigation.psiId)
    );

    const missingSummaryRes = await fetch(`${baseUrl}/api/investigations/does-not-exist/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: 'Student' }),
    });
    assert.equal(missingSummaryRes.status, 404);
  } finally {
    server.close();
  }
});
