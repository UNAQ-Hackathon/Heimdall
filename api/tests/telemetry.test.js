import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app.js';
import {
  loadProcessedInvestigations,
  normalizeInvestigationDoc,
} from '../src/utils/processed-dataset.js';

test('normalizeInvestigationDoc preserves slug and enriches partial MongoDB records', async () => {
  const processed = await loadProcessedInvestigations();
  const partial = {
    _id: '675000000000000000000009',
    slug: 'acme-bre',
    name: 'BRE',
    sources: { psiId: 'PSI-ACME-BRE' },
  };
  const normalized = normalizeInvestigationDoc(partial, processed);
  assert.equal(normalized.slug, 'acme-bre');
  assert.equal(normalized.acronym, 'BRE');
  assert.equal(normalized.psiId, 'PSI-ACME-BRE');
  assert.ok(normalized.sensors.length > 0);
});

test('GET /api/telemetry and /api/investigations/:id/telemetry resolve studies reliably', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const tAll = await fetch(`${baseUrl}/api/telemetry`);
    assert.equal(tAll.status, 200);
    const allBody = await tAll.json();
    assert.ok(Array.isArray(allBody.experiments));
    assert.equal(typeof allBody.totalExperiments, 'number');
    assert.ok(Array.isArray(allBody.measurements));

    const tStudy = await fetch(`${baseUrl}/api/investigations/acme-cfi-g/telemetry`);
    assert.equal(tStudy.status, 200);
    const studyBody = await tStudy.json();
    assert.equal(studyBody.investigation.acronym, 'CFI-G');
    assert.equal(studyBody.investigation.slug, 'acme-cfi-g');
    assert.equal(typeof studyBody.totalExperiments, 'number');

    const byAcronym = await fetch(`${baseUrl}/api/investigations/BASS`);
    assert.equal(byAcronym.status, 200);
    const bassBody = await byAcronym.json();
    assert.equal(bassBody.psiId, 'PSI-BASS');

    const missing = await fetch(`${baseUrl}/api/investigations/does-not-exist/telemetry`);
    assert.equal(missing.status, 404);
  } finally {
    server.close();
  }
});
