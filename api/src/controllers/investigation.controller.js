import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';
import HttpError from '../utils/http-error.js';
import { getAllInvestigations } from '../utils/processed-dataset.js';

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
        doc.fuel?.toLowerCase().includes(lower)
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
    if (doc) return res.json(doc);
  }
  const all = await getAllInvestigations();
  const lower = String(id).toLowerCase();
  const slugify = (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/^psi-/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  const found = all.find(
    (doc) =>
      String(doc._id ?? '').toLowerCase() === lower ||
      String(doc.psiId ?? '').toLowerCase() === lower ||
      String(doc.acronym ?? '').toLowerCase() === lower ||
      slugify(doc.psiId ?? doc.acronym ?? doc.title) === lower ||
      String(doc.acronym ?? '')
        .toLowerCase()
        .replace(/\s+/g, '-') === lower
  );
  if (!found) return next(new HttpError(404, 'Investigation not found'));
  res.json(found);
}
