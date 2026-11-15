/**
 * Migrates the canonical processed PSI records into the MongoDB
 * `investigations` collection so Mongo is the complete data source.
 *
 *  - Existing Mongo docs (slug/name/sources.psiId schema, seeded from the
 *    PSI CSV exports) get the canonical fields $set on them: psiId, acronym,
 *    measured conditions ranges, series, experimentRuns, provenance, etc.
 *    Their native fields (slug, name, family, sources, researchType,
 *    relevance, status) are preserved — the collection's $jsonSchema
 *    validator requires them and rejects 'published'/'upcoming' statuses.
 *    Canonical status semantics still reach the API via `dataAvailable`.
 *  - Processed studies missing from Mongo are inserted with the fields the
 *    validator requires (slug, name, researchType, relevance, status).
 *
 * Reads only data/processed/psi-investigations.json — never fabricates values.
 * Usage: cd api && node scripts/enrich-mongo-psi.js
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../src/config/db.js';
import { slugifyInvestigationKey } from '../src/utils/processed-dataset.js';

const PROCESSED = path.resolve(
  import.meta.dirname,
  '../../data/processed/psi-investigations.json'
);

// 'status' excluded: Mongo validator only accepts 'catalog_only'|'ingested'.
const CANONICAL_FIELDS = [
  'psiId', 'acronym', 'title', 'objective', 'fuel', 'fuelType', 'hardware',
  'category', 'gravityLevel', 'dataAvailable', 'conditions',
  'variables', 'sensors', 'series', 'seriesSource', 'experimentRuns',
  'earthApplications', 'sourceUrl', 'tags',
];

const processed = JSON.parse(await readFile(PROCESSED, 'utf8'));
await connectDB();
const col = mongoose.connection.db.collection('investigations');
const mongoDocs = await col.find({}).toArray();

function matchProcessed(mongoDoc) {
  const keys = [mongoDoc.slug, mongoDoc.psiId, mongoDoc.sources?.[0]?.psiId, mongoDoc.name, mongoDoc.title]
    .filter((v) => v !== undefined && v !== null)
    .map((v) => slugifyInvestigationKey(v));
  const numericPsi = mongoDoc.sources?.[0]?.psiId;
  if (Number.isFinite(numericPsi)) keys.push(`psi-${numericPsi}`);
  return (
    processed.find((p) =>
      [p.psiId, p.acronym, p.title]
        .filter(Boolean)
        .map((v) => slugifyInvestigationKey(v))
        .some((k) => keys.includes(k))
    ) ?? null
  );
}

let updated = 0;
let inserted = 0;
const matchedPsiIds = new Set();

for (const doc of mongoDocs) {
  const match = matchProcessed(doc);
  if (!match) {
    console.log(`  keep untouched (no canonical match): ${doc.slug ?? doc.name}`);
    continue;
  }
  matchedPsiIds.add(match.psiId);
  const $set = {};
  for (const f of CANONICAL_FIELDS) {
    if (match[f] !== undefined) $set[f] = match[f];
  }
  // Canonical status can't live in mongo 'status' (validator enum) — keep a copy
  $set.psiStatus = match.status;
  await col.updateOne({ _id: doc._id }, { $set });
  updated += 1;
  console.log(`  updated: ${doc.slug} ← ${match.acronym} (${match.experimentRuns ?? 0} runs, ${(match.series ?? []).length} series)`);
}

for (const doc of processed) {
  if (matchedPsiIds.has(doc.psiId)) continue;
  const { status, ...rest } = doc;
  await col.insertOne({
    ...rest,
    slug: slugifyInvestigationKey(doc.psiId ?? doc.acronym),
    name: doc.acronym ?? doc.title,
    researchType: doc.category ? [doc.category] : ['fundamental'],
    relevance: 'pending',
    status: status === 'upcoming' ? 'catalog_only' : 'ingested',
    psiStatus: status,
  });
  inserted += 1;
  console.log(`  inserted: ${doc.acronym} (${status})`);
}

console.log(`done: ${updated} updated, ${inserted} inserted, total ${await col.countDocuments()} investigations`);
await disconnectDB();
