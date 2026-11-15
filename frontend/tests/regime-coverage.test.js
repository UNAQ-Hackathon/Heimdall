import test from 'node:test';
import assert from 'node:assert/strict';
import { processedInvestigations } from '../src/services/ranking.js';
import {
  buildConvexHullQueryPoints,
  extractPsiRegimeCoords,
} from '../src/services/regime-coverage.js';

test('extractPsiRegimeCoords excludes upcoming studies without numeric coordinates', () => {
  const coords = extractPsiRegimeCoords(processedInvestigations);
  assert.ok(coords.length >= 15);
  assert.ok(!coords.some((c) => c.acronym === 'LUCI' || c.acronym === 'FM2'));
  assert.ok(coords.some((c) => c.acronym === 'BASS-II' && c.o2Min === 13.5 && c.o2Max === 30));
  assert.ok(coords.some((c) => c.acronym === 'SoFIE' && c.o2Max === 36 && c.x === 0.2));
});

test('buildConvexHullQueryPoints spans full O2 bounds without inferring flammability from category', () => {
  const pts = buildConvexHullQueryPoints(processedInvestigations);
  assert.ok(pts.length >= 12);

  const o2Values = pts.map((p) => p.oxygen_pct);
  assert.equal(Math.min(...o2Values), 13.5);
  assert.equal(Math.max(...o2Values), 50);

  // Every point strictly encodes tested regime coverage, never a synthetic category!==suppression label
  assert.ok(pts.every((p) => p.flammable === true));
});
