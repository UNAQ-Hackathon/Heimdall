import mongoose from 'mongoose';
import Investigation from '../models/Investigation.js';
import { detectTrends, flammabilityMap } from '../services/analytics.service.js';
import { interpretFirehazrResult, PSI_FALLBACK_DOCS } from '../services/devin.service.js';

const BASE_PRESETS = [
  {
    id: 'flex-published',
    label: 'FLEX-2 Baseline · 21% O₂ · Methanol (765 mmHg)',
    studyAcronym: 'FLEX-2',
    suitState: 'normal',
    note: 'Published NASA FLEX-2 microgravity droplet burn reference in Earth-like O₂/N₂.',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 765,
      o2_fraction: 0.21,
      n2_fraction: 0.79,
      co2_fraction: 0,
      he_fraction: 0,
      diameter_mm: 1.8,
    },
  },
  {
    id: 'flex-co2-suppression',
    label: 'FLEX-2 CO₂ Suppression · 19% O₂ + 20% CO₂ · Heptane',
    studyAcronym: 'FLEX-2',
    suitState: 'normal',
    note: 'Tests CO₂ atmospheric dilution used in ISS fire-suppression research (CIR/MDCA).',
    conditions: {
      fuel: 'Heptane',
      pressure_mmhg: 760,
      o2_fraction: 0.19,
      n2_fraction: 0.61,
      co2_fraction: 0.2,
      he_fraction: 0,
      diameter_mm: 2.2,
    },
  },
  {
    id: 'flex-he-dilution',
    label: 'FLEX-2 He Dilution · 18% O₂ + 25% He · Methanol',
    studyAcronym: 'FLEX-2',
    suitState: 'normal',
    note: 'Evaluates helium inert-gas dilution effects on droplet burn duration.',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 750,
      o2_fraction: 0.18,
      n2_fraction: 0.57,
      co2_fraction: 0,
      he_fraction: 0.25,
      diameter_mm: 2.4,
    },
  },
  {
    id: 'lunar-30',
    label: 'Lunar Habitat Bound · 30% O₂ · Methanol (537.3 mmHg)',
    studyAcronym: 'BASS-II',
    suitState: 'flames',
    note: 'Verified FLEX O₂/N₂ regime at reduced lunar-habitat pressure (537.3 mmHg) and 30% O₂.',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 537.3,
      o2_fraction: 0.3,
      n2_fraction: 0.7,
      co2_fraction: 0,
      he_fraction: 0,
      diameter_mm: 2.6,
    },
  },
  {
    id: 'lunar-34',
    label: 'Lunar Max O₂ · 34% O₂ · Methanol (539.1 mmHg)',
    studyAcronym: 'BASS-II',
    suitState: 'flames',
    note: 'Upper supported FLEX O₂/N₂ concentration (34% O₂) at reduced pressure (539.1 mmHg).',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 539.1,
      o2_fraction: 0.34,
      n2_fraction: 0.66,
      co2_fraction: 0,
      he_fraction: 0,
      diameter_mm: 3.39,
    },
  },
  {
    id: 'lunar-heptane-30',
    label: 'Lunar Habitat · 30% O₂ · Heptane (537.3 mmHg)',
    studyAcronym: 'BASS-II',
    suitState: 'flames',
    note: 'Verified Heptane O₂/N₂ droplet test at reduced pressure (537.3 mmHg) and 30% O₂.',
    conditions: {
      fuel: 'Heptane',
      pressure_mmhg: 537.3,
      o2_fraction: 0.3,
      n2_fraction: 0.7,
      co2_fraction: 0,
      he_fraction: 0,
      diameter_mm: 2.6,
    },
  },
  {
    id: 'high-p-co2-heptane',
    label: 'Hyperbaric CO₂ · 21% O₂ + 70% CO₂ · Heptane (1553.8 mmHg)',
    studyAcronym: 'FLEX-2',
    suitState: 'normal',
    note: 'Verified high-pressure CO₂ suppression regime (1553.8 mmHg) for Heptane.',
    conditions: {
      fuel: 'Heptane',
      pressure_mmhg: 1553.8,
      o2_fraction: 0.21,
      n2_fraction: 0.09,
      co2_fraction: 0.7,
      he_fraction: 0,
      diameter_mm: 2.74,
    },
  },
  {
    id: 'high-p-co2-methanol',
    label: 'Hyperbaric CO₂ · 21% O₂ + 70% CO₂ · Methanol (1553.8 mmHg)',
    studyAcronym: 'FLEX-2',
    suitState: 'normal',
    note: 'Verified high-pressure CO₂ suppression regime (1553.8 mmHg) for Methanol.',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 1553.8,
      o2_fraction: 0.21,
      n2_fraction: 0.09,
      co2_fraction: 0.7,
      he_fraction: 0,
      diameter_mm: 2.74,
    },
  },
  {
    id: 'low-p-co2-50',
    label: 'Low-Pressure CO₂ · 15% O₂ + 50% CO₂ · Methanol (533.5 mmHg)',
    studyAcronym: 'FLEX',
    suitState: 'normal',
    note: 'Verified reduced-pressure CO₂ inerting regime (533.5 mmHg, 50% CO₂).',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 533.5,
      o2_fraction: 0.15,
      n2_fraction: 0.35,
      co2_fraction: 0.5,
      he_fraction: 0,
      diameter_mm: 3.98,
    },
  },
  {
    id: 'low-p-he-45',
    label: 'Low-Pressure He · 17% O₂ + 45% He · Methanol (532.2 mmHg)',
    studyAcronym: 'FLEX',
    suitState: 'normal',
    note: 'Verified reduced-pressure Helium dilution regime (532.2 mmHg, 45% He).',
    conditions: {
      fuel: 'Methanol',
      pressure_mmhg: 532.2,
      o2_fraction: 0.17,
      n2_fraction: 0.38,
      co2_fraction: 0,
      he_fraction: 0.45,
      diameter_mm: 2.22,
    },
  },
  {
    id: 'eva-suit-extreme',
    label: 'EVA Suit Extreme · 85% O₂ · 222 mmHg (Out of FLEX range)',
    studyAcronym: 'CFI-G',
    suitState: 'burned',
    note: 'High-O₂ / low-pressure EVA-like condition (model abstains; demonstrates coverage gate).',
    conditions: {
      fuel: 'Heptane',
      pressure_mmhg: 222,
      o2_fraction: 0.85,
      n2_fraction: 0.15,
      co2_fraction: 0,
      he_fraction: 0,
      diameter_mm: 2.4,
    },
  },
];

export async function firehazrPresets(_req, res) {
  let docs = PSI_FALLBACK_DOCS;
  let source = 'fallback';
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoDocs = await Investigation.find(
        {},
        { id: 1, psiId: 1, slug: 1, name: 1, family: 1, acronym: 1, title: 1, hardware: 1, oxygenRange: 1, ambientPressure: 1, fuelType: 1 }
      )
        .limit(50)
        .lean();
      if (mongoDocs.length > 0) {
        docs = mongoDocs;
        source = 'mongodb';
      }
    } catch {
      // Keep fallback docs
    }
  }

  const presets = BASE_PRESETS.map((preset) => {
    const keyLower = preset.studyAcronym.toLowerCase();
    const match = docs.find((d) => {
      const candidates = [d.acronym, d.name, d.family, d.slug, d.title]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return candidates.some((c) => c === keyLower || c.includes(keyLower));
    });
    return {
      ...preset,
      study: match
        ? {
            id: match.id ?? match.studyId ?? match.slug ?? match._id,
            acronym: match.acronym ?? match.name ?? preset.studyAcronym,
            title: match.title ?? match.name ?? preset.studyAcronym,
            hardware: match.hardware ?? null,
            oxygenRange: match.oxygenRange ?? null,
            ambientPressure: match.ambientPressure ?? null,
          }
        : null,
    };
  });

  res.json({ source, presets });
}

export async function firehazrInterpret(req, res) {
  const { conditions, result, study } = req.body ?? {};
  if (!result?.aceptado) {
    return res.json({
      skipped: true,
      reason: 'out_of_range',
      interpretation: null,
      usage: null,
    });
  }
  const output = await interpretFirehazrResult({ conditions, result, study });
  if (output?.unavailable) {
    return res.status(503).json({
      error: {
        message: output.reason ?? 'AI interpretation is not configured on this server.',
      },
    });
  }
  return res.json(output);
}

export async function trends(req, res) {
  res.json(await detectTrends(req.body.series));
}

export async function flammability(req, res) {
  const { points, grid } = req.body;
  res.json(await flammabilityMap(points, grid));
}
