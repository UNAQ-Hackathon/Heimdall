import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transformInvestigation } from './transform.js';
import { enrichWithPsiTables } from './psi-tables.js';

const RAW = path.resolve(import.meta.dirname, '../raw');
const TABLES = path.resolve(RAW, 'psi-tables');
// PSI CSV exports live outside the repo (Downloads). Skip when absent.
const TABLES_PRESENT = existsSync(TABLES);

async function enrichedDocs() {
  const raw = JSON.parse(await readFile(path.join(RAW, 'psi-investigations.json'), 'utf8'));
  const docs = raw.map(transformInvestigation);
  const summary = await enrichWithPsiTables(docs, TABLES);
  return { docs, summary };
}

test('PSI tables enrich 16 studies with real run counts and series provenance', { skip: !TABLES_PRESENT }, async () => {
  const { docs, summary } = await enrichedDocs();
  assert.equal(docs.length, 23);
  assert.equal(summary.length, 16);

  const flex = docs.find((d) => d.acronym === 'FLEX');
  assert.equal(flex.experimentRuns, 274);
  assert.equal(flex.series.length, 6);
  assert.equal(flex.series.reduce((n, s) => n + s.samples.length, 0), 260);
  assert.ok(flex.seriesSource.includes('PSI-69'));
  assert.ok(flex.series.every((s) => s.sourceUrl.includes('psi.nasa.gov')));

  const bass2 = docs.find((d) => d.acronym === 'BASS-II');
  assert.equal(bass2.experimentRuns, 129);
  assert.equal(bass2.series.length, 2);

  // LUCI/FM2 remain untouched placeholders
  for (const acr of ['LUCI', 'FM2']) {
    const doc = docs.find((d) => d.acronym === acr);
    assert.equal(doc.experimentRuns, null);
    assert.deepEqual(doc.series, []);
  }
});

test('enriched conditions never contain physically impossible or unparseable values', { skip: !TABLES_PRESENT }, async () => {
  const { docs } = await enrichedDocs();
  for (const doc of docs) {
    const c = doc.conditions ?? {};
    for (const key of ['oxygenPct', 'oxygenMinPct', 'oxygenMaxPct']) {
      const v = c[key];
      if (v == null) continue;
      assert.ok(Number.isFinite(v), `${doc.acronym}.${key} must be finite`);
      assert.ok(v >= 0 && v <= 100, `${doc.acronym}.${key}=${v} outside 0–100% O2`);
    }
    if (c.pressurePsi != null) {
      assert.ok(c.pressurePsi > 0 && c.pressurePsi <= 300, `${doc.acronym} pressure ${c.pressurePsi}`);
    }
    if (c.flowVelocity != null) {
      assert.ok(c.flowVelocity >= 0 && c.flowVelocity <= 20, `${doc.acronym} flow ${c.flowVelocity}`);
    }
    for (const s of doc.series ?? []) {
      assert.ok(s.samples.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
      assert.ok(s.seriesSource?.includes('PSI-'), `${doc.acronym} series lacks PSI provenance`);
    }
  }

  // Corrupted cells ("3400%", "LOW O2") must not leak into measured ranges
  const bre = docs.find((d) => d.acronym === 'BRE');
  assert.equal(bre.conditions.oxygenMaxPct, 40);
  const flame = docs.find((d) => d.acronym === 'Flame Design');
  assert.ok(flame.conditions.oxygenMaxPct < 100);
});
