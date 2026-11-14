import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';

const PROCESSED_FILE = path.resolve(
  import.meta.dirname,
  '../../../data/processed/psi-investigations.json'
);

let cachedProcessed = null;

export async function loadProcessedInvestigations() {
  if (cachedProcessed) return cachedProcessed;
  const raw = await readFile(PROCESSED_FILE, 'utf8');
  cachedProcessed = JSON.parse(raw);
  return cachedProcessed;
}

export async function getAllInvestigations() {
  if (mongoose.connection.readyState === 1) {
    try {
      const docs = await Investigation.find().lean();
      if (docs.length > 0) return docs;
    } catch {
      // Fall through to processed JSON file
    }
  }
  return loadProcessedInvestigations();
}
