import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import Investigation from '../models/Investigation.js';

const SEED_DIR = path.resolve(import.meta.dirname, '../../../data/processed');

async function main() {
  const files = (await readdir(SEED_DIR)).filter((f) => f.endsWith('.json'));
  const allDocs = [];

  for (const file of files) {
    const docs = JSON.parse(await readFile(path.join(SEED_DIR, file), 'utf8'));
    const list = Array.isArray(docs) ? docs : [docs];
    for (const doc of list) {
      const instance = new Investigation(doc);
      await instance.validate();
      allDocs.push(doc);
    }
  }

  let dbConnected = false;
  try {
    await connectDB();
    dbConnected = true;
  } catch (err) {
    console.warn(`[seed] MongoDB connection unavailable (${err.message}); validated ${allDocs.length} docs against schema.`);
  }

  if (dbConnected) {
    const ops = allDocs.map((doc) => ({
      updateOne: {
        filter: { psiId: doc.psiId },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const res = await Investigation.bulkWrite(ops, { ordered: false });
    const total = (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0) + (res.matchedCount ?? 0);
    console.log(`[seed] ${allDocs.length} investigations loaded (${total} synced) into ${env.mongoUri}`);
    await disconnectDB();
  } else {
    console.log(`[seed] ${allDocs.length} investigations validated and ready in data/processed/`);
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
