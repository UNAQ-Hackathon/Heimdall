import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';
import HttpError from '../utils/http-error.js';
import {
  findInvestigationById,
  getAllInvestigations,
  getInvestigationTelemetry,
  loadProcessedInvestigations,
  normalizeInvestigationDoc,
} from '../utils/processed-dataset.js';
import { summarizeInvestigation } from '../services/devin.service.js';

export async function list(req, res) {
  const { q, acronym, gravity, category, fuelType, page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);

  let all = await getAllInvestigations();
  if (q) {
    const lower = String(q).toLowerCase();
    all = all.filter(
      (doc) =>
        doc.title?.toLowerCase().includes(lower) ||
        doc.acronym?.toLowerCase().includes(lower) ||
        doc.objective?.toLowerCase().includes(lower) ||
        doc.fuel?.toLowerCase().includes(lower) ||
        doc.slug?.toLowerCase().includes(lower)
    );
  }
  if (acronym) {
    all = all.filter((doc) => doc.acronym?.toLowerCase() === String(acronym).toLowerCase());
  }
  if (gravity) {
    all = all.filter((doc) => doc.gravityLevel === gravity);
  }
  if (category && category !== 'all') {
    all = all.filter((doc) => doc.category === category);
  }
  if (fuelType && fuelType !== 'all') {
    all = all.filter((doc) => doc.fuelType === fuelType);
  }

  const total = all.length;
  const items = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  res.json({ items, total, page: pageNum, limit: limitNum });
}

export async function getById(req, res, next) {
  const { id } = req.params;
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    const doc = await Investigation.findById(id).lean();
    if (doc) {
      const processed = await loadProcessedInvestigations();
      return res.json(normalizeInvestigationDoc(doc, processed));
    }
  }
  const found = await findInvestigationById(id);
  if (!found) return next(new HttpError(404, 'Investigation not found'));
  res.json(found);
}

export async function getTelemetry(req, res, next) {
  const { id } = req.params;
  const payload = await getInvestigationTelemetry(id ?? null);
  if (id && !payload) {
    return next(new HttpError(404, 'Investigation telemetry not found'));
  }
  res.json(payload);
}

export async function summarize(req, res, next) {
  const { id } = req.params;
  const audience = req.body?.audience === 'Student' ? 'Student' : 'Engineer';

  let found = null;
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    const doc = await Investigation.findById(id).lean();
    if (doc) {
      const processed = await loadProcessedInvestigations();
      found = normalizeInvestigationDoc(doc, processed);
    }
  }
  if (!found) {
    found = await findInvestigationById(id);
  }
  if (!found) return next(new HttpError(404, 'Investigation not found'));

  const result = await summarizeInvestigation(found, { audience });
  res.json({
    id: found.slug ?? id,
    psiId: found.psiId,
    acronym: found.acronym,
    audience,
    ...result,
  });
}
