import { rankInvestigations } from '../services/ranking.service.js';
import { getAllInvestigations } from '../utils/processed-dataset.js';

export async function rank(req, res) {
  const { scenario, weights, limit = 50 } = req.body;
  const investigations = await getAllInvestigations();
  const ranked = rankInvestigations(investigations, scenario, weights).slice(0, limit);
  res.json({ scenario, count: ranked.length, results: ranked });
}
