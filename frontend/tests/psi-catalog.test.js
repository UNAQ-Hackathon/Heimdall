import test from 'node:test';
import assert from 'node:assert/strict';

import processedInvestigations from '../../data/processed/psi-investigations.json' with { type: 'json' };
import {
  CATALOG_HARDWARE_FILTERS,
  filterPsiInvestigations,
  summarizeCatalogMetrics,
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
  assert.equal(summary.count, 20);
  assert.equal(summary.oxygenMinPct, 13.5);
  assert.equal(summary.oxygenMaxPct, 85);
  assert.ok(summary.hardwareCount >= 5);
  assert.ok(summary.earthApplicationsCount >= 20);
});
