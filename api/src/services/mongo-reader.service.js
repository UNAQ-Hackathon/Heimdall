import mongoose from 'mongoose';

/**
 * Strictly read-only MongoDB reader for Gemini AI Copilot.
 * Never performs inserts, updates, deletes, or $out/$merge aggregations.
 */
export async function getReadOnlyMongoContext(question = '') {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      connected: false,
      database: null,
      collections: {},
      investigations: [],
      experimentSummary: [],
      scenarios: [],
      matchedExperiments: [],
    };
  }

  const db = mongoose.connection.db;
  const collectionNames = ['investigations', 'experiments', 'scenarios', 'measurements'];
  const countsEntries = await Promise.all(
    collectionNames.map(async (name) => {
      try {
        const count = await db.collection(name).countDocuments();
        return [name, count];
      } catch {
        return [name, 0];
      }
    })
  );
  const collections = Object.fromEntries(countsEntries);

  const [investigations, scenarios, experimentSummary] = await Promise.all([
    db
      .collection('investigations')
      .find(
        {},
        {
          projection: {
            _id: 0,
            slug: 1,
            name: 1,
            family: 1,
            researchType: 1,
            status: 1,
            'sources.psiId': 1,
          },
        }
      )
      .sort({ name: 1 })
      .limit(30)
      .toArray(),
    db
      .collection('scenarios')
      .find(
        {},
        {
          projection: {
            _id: 0,
            key: 1,
            name: 1,
            gravity: 1,
            o2Percent: 1,
            pressureKpa: 1,
          },
        }
      )
      .limit(10)
      .toArray(),
    db
      .collection('experiments')
      .aggregate([
        {
          $group: {
            _id: '$investigationSlug',
            runs: { $sum: 1 },
            o2Min: { $min: '$o2Percent' },
            o2Max: { $max: '$o2Percent' },
            pressureKpaMin: { $min: '$pressureKpa' },
            pressureKpaMax: { $max: '$pressureKpa' },
            fuels: { $addToSet: '$fuel.family' },
          },
        },
        { $sort: { runs: -1 } },
        { $limit: 25 },
      ])
      .toArray(),
  ]);

  let matchedExperiments = [];
  const tokens = String(question)
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 4);

  if (tokens.length > 0) {
    const regex = new RegExp(tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
    matchedExperiments = await db
      .collection('experiments')
      .find(
        {
          $or: [
            { investigationSlug: regex },
            { 'fuel.material': regex },
            { 'fuel.family': regex },
          ],
        },
        {
          projection: {
            _id: 0,
            runId: 1,
            investigationSlug: 1,
            'fuel.material': 1,
            'fuel.family': 1,
            o2Percent: 1,
            pressureKpa: 1,
            flowVelocityMs: 1,
            'gravity.regime': 1,
          },
        }
      )
      .limit(12)
      .toArray();
  }

  return {
    connected: true,
    readOnly: true,
    database: db.databaseName,
    collections,
    investigations,
    experimentSummary,
    scenarios,
    matchedExperiments,
  };
}
