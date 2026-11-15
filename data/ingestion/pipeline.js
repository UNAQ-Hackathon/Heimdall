/**
 * Ingestion pipeline: data/raw/*.json → normalized data/processed/*.json
 * Then load with: cd api && npm run seed
 *
 * Usage: node data/ingestion/pipeline.js
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { transformInvestigation } from './transform.js';
import { enrichWithPsiTables } from './psi-tables.js';

const RAW = path.resolve(import.meta.dirname, '../raw');
const TABLES = path.resolve(RAW, 'psi-tables');
const OUT = path.resolve(import.meta.dirname, '../processed');

const files = (await readdir(RAW)).filter((f) => f.endsWith('.json'));
await mkdir(OUT, { recursive: true });

for (const file of files) {
  const raw = JSON.parse(await readFile(path.join(RAW, file), 'utf8'));
  const list = Array.isArray(raw) ? raw : [raw];
  const docs = list.map(transformInvestigation);
  const enriched = await enrichWithPsiTables(docs, TABLES);
  const out = path.join(OUT, file);
  await writeFile(out, JSON.stringify(docs, null, 2));
  console.log(`${file} → ${docs.length} docs`);
  for (const e of enriched) {
    console.log(`  PSI table: ${e.acronym} ← ${e.rows} runs, ${e.series} series`);
  }
}
