import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';

const PROCESSED_FILE = path.resolve(
  import.meta.dirname,
  '../../../data/processed/psi-investigations.json'
);

let cachedProcessed = null;

export function slugifyInvestigationKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^psi-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function loadProcessedInvestigations() {
  if (cachedProcessed) return cachedProcessed;
  const raw = await readFile(PROCESSED_FILE, 'utf8');
  cachedProcessed = JSON.parse(raw);
  return cachedProcessed;
}

function findProcessedMatch(doc, processedList) {
  const candidates = [
    doc.slug,
    doc.psiId,
    doc.sources?.psiId,
    doc.acronym,
    doc.name,
    doc.title,
  ]
    .filter(Boolean)
    .map((v) => slugifyInvestigationKey(v));

  if (!candidates.length) return null;

  return (
    processedList.find((item) => {
      const itemKeys = [item.psiId, item.acronym, item.title]
        .filter(Boolean)
        .map((v) => slugifyInvestigationKey(v));
      return candidates.some((c) => itemKeys.includes(c));
    }) ?? null
  );
}

/**
 * Ensures investigation documents (including partial MongoDB schemas with
 * `slug`/`name`/`sources.psiId`) always carry canonical PSI fields and a valid slug.
 */
export function normalizeInvestigationDoc(doc, processedList = []) {
  if (!doc) return doc;
  const match = findProcessedMatch(doc, processedList);
  const merged = match ? { ...match, ...doc } : { ...doc };
  const resolvedPsiId =
    doc.psiId ?? doc.sources?.psiId ?? match?.psiId ?? undefined;
  const resolvedSlug =
    doc.slug ??
    slugifyInvestigationKey(
      resolvedPsiId ?? doc.acronym ?? doc.name ?? doc.title ?? doc._id
    );

  return {
    ...merged,
    slug: resolvedSlug,
    psiId: resolvedPsiId ?? merged.psiId,
    acronym: doc.acronym ?? doc.name ?? match?.acronym ?? merged.acronym,
    title: doc.title ?? match?.title ?? doc.name ?? merged.title,
    hardware: doc.hardware ?? match?.hardware ?? doc.family ?? merged.hardware,
    category: doc.category ?? match?.category ?? doc.researchType ?? merged.category,
  };
}

export async function getAllInvestigations() {
  const processed = await loadProcessedInvestigations();
  if (mongoose.connection.readyState === 1) {
    try {
      const docs = await Investigation.find().lean();
      if (docs.length > 0) {
        return docs.map((doc) => normalizeInvestigationDoc(doc, processed));
      }
    } catch {
      // Fall through to processed JSON file
    }
  }
  return processed.map((doc) => normalizeInvestigationDoc(doc, processed));
}

export async function findInvestigationById(id) {
  const all = await getAllInvestigations();
  const lower = String(id ?? '').toLowerCase();
  const slugTarget = slugifyInvestigationKey(id);

  return (
    all.find((doc) => {
      const keys = [
        doc._id,
        doc.slug,
        doc.psiId,
        doc.sources?.psiId,
        doc.acronym,
        doc.name,
      ]
        .filter((v) => v != null)
        .map((v) => String(v).toLowerCase());

      if (keys.includes(lower)) return true;

      const slugKeys = [
        doc.slug,
        doc.psiId,
        doc.sources?.psiId,
        doc.acronym,
        doc.name,
        doc.title,
      ]
        .filter(Boolean)
        .map((v) => slugifyInvestigationKey(v));

      return slugTarget && slugKeys.includes(slugTarget);
    }) ?? null
  );
}

/**
 * Fetches read-only telemetry context (live MongoDB experiments/measurements when
 * connected, plus the canonical investigation record). Never fabricates values.
 */
export async function getInvestigationTelemetry(id) {
  const investigation = id ? await findInvestigationById(id) : null;
  if (id && !investigation) return null;

  let experiments = [];
  let measurements = [];
  let source = 'processed-archive';

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const db = mongoose.connection.db;
    const slugTokens = investigation
      ? [
          investigation.slug,
          investigation.acronym,
          investigation.psiId,
          slugifyInvestigationKey(investigation.acronym),
        ].filter(Boolean)
      : [];

    const expQuery = slugTokens.length
      ? {
          $or: slugTokens.flatMap((token) => [
            { investigationSlug: new RegExp(`^${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { investigation: new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          ]),
        }
      : {};

    try {
      experiments = await db
        .collection('experiments')
        .find(expQuery, { projection: { _id: 0 } })
        .limit(300)
        .toArray();
      if (experiments.length > 0) source = 'mongodb';
    } catch {
      experiments = [];
    }

    try {
      const runIds = experiments.map((e) => e.runId).filter(Boolean);
      const measQuery = slugTokens.length
        ? {
            $or: [
              ...slugTokens.map((token) => ({
                investigationSlug: new RegExp(`^${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
              })),
              ...(runIds.length ? [{ runId: { $in: runIds } }] : []),
            ],
          }
        : {};
      measurements = await db
        .collection('measurements')
        .find(measQuery, { projection: { _id: 0 } })
        .limit(500)
        .toArray();
      if (measurements.length > 0) source = 'mongodb';
    } catch {
      measurements = [];
    }
  }

  return {
    investigation,
    experiments,
    measurements,
    source,
  };
}
