import test from 'node:test';
import assert from 'node:assert/strict';

import processedInvestigations from '../../data/processed/psi-investigations.json' with { type: 'json' };
import {
  buildPsiDatasetCsv,
  CATALOG_DATA_FILTERS,
  CATALOG_HARDWARE_FILTERS,
  filterPsiInvestigations,
  getHardwareFamily,
  summarizeCatalogMetrics,
  summarizeInvestigationDifferences,
} from '../src/services/psi-catalog.js';

test('filterPsiInvestigations filters by pillar, fuelType, hardware, and query', () => {
  const byCategory = filterPsiInvestigations(processedInvestigations, { category: 'detection' });
  assert.ok(byCategory.length > 0);
  assert.ok(byCategory.every((item) => item.category === 'detection'));

  const byFuel = filterPsiInvestigations(processedInvestigations, { fuelType: 'droplet' });
  assert.ok(byFuel.length > 0);
  assert.ok(byFuel.every((item) => item.fuelType === 'droplet'));

  const byHardware = filterPsiInvestigations(processedInvestigations, { hardware: 'acme' });
  assert.equal(byHardware.length, 6);
  assert.ok(byHardware.every((item) => /ACME/i.test(item.hardware)));

  const byQuery = filterPsiInvestigations(processedInvestigations, { query: '85%' });
  assert.ok(byQuery.some((item) => item.acronym === 'CFI-G'));
});

test('every hardware filter chip matches at least one verified PSI study', () => {
  CATALOG_HARDWARE_FILTERS.forEach((chip) => {
    const matches = filterPsiInvestigations(processedInvestigations, { hardware: chip.id });
    assert.ok(matches.length > 0, `Hardware filter ${chip.id} should match at least one PSI study`);
  });
});

test('summarizeCatalogMetrics reports exact observed counts and O2 bounds without inventing values', () => {
  const summary = summarizeCatalogMetrics(processedInvestigations);
  assert.equal(summary.count, 23);
  assert.equal(summary.oxygenMinPct, 13.5);
  assert.equal(summary.oxygenMaxPct, 85);
  assert.ok(summary.hardwareCount >= 5);
  assert.ok(summary.earthApplicationsCount >= 23);
});

test('dataStatus filters isolate FLEX empirical series and upcoming LUCI/FM2 records cleanly', () => {
  assert.ok(CATALOG_DATA_FILTERS.length === 4);

  const seriesOnly = filterPsiInvestigations(processedInvestigations, { dataStatus: 'series' });
  assert.deepEqual(
    seriesOnly.map((item) => item.acronym),
    ['FLEX']
  );

  const upcomingOnly = filterPsiInvestigations(processedInvestigations, { dataStatus: 'upcoming' });
  assert.deepEqual(
    upcomingOnly.map((item) => item.acronym),
    ['LUCI', 'FM2']
  );

  const publishedOnly = filterPsiInvestigations(processedInvestigations, { dataStatus: 'published' });
  assert.equal(publishedOnly.length, 21);
});

test('buildPsiDatasetCsv and summarizeInvestigationDifferences extract verified PSI attributes', () => {
  const flex = processedInvestigations.find((i) => i.acronym === 'FLEX');
  const cfiG = processedInvestigations.find((i) => i.acronym === 'CFI-G');
  const luci = processedInvestigations.find((i) => i.acronym === 'LUCI');

  const csv = buildPsiDatasetCsv([flex, luci]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes('seriesPointCount'));
  assert.ok(lines[1].includes('"258"'));
  assert.ok(lines[2].includes('"false"'));

  assert.equal(getHardwareFamily(cfiG.hardware), 'CIR / ACME (Modular Gas Rack)');

  const digest = summarizeInvestigationDifferences([flex, cfiG, luci]);
  assert.ok(digest.differences.some((d) => d.includes('Different fuel phases')));
  assert.ok(digest.differences.some((d) => d.includes('LUCI')));
});
