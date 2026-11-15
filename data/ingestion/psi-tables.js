/**
 * PSI experimental-table enrichment.
 *
 * Parses the real NASA PSI "Experimental table" CSV exports in
 * data/raw/psi-tables/ and merges per-run measurements into the
 * transformed investigation docs:
 *   - experimentRuns: number of rows in the table
 *   - conditions.oxygenMinPct/MaxPct, pressurePsi, flowVelocity
 *     recomputed from the real columns (never extrapolated)
 *   - series: measured curves ([x, value]) with per-series provenance
 *
 * PSI-142 (bibliographic data summary) and PSI-181 (Pb-Sn microscopy,
 * materials science — not a fire-safety study) carry no usable
 * combustion measurements and are intentionally skipped.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const PSI_REPO = 'https://psi.nasa.gov/physci/repo/data/investigations';
const MMHG_TO_PSI = 14.6959 / 760;
const ATM_TO_PSI = 14.6959;
const BAR_TO_PSI = 14.5038;
const CMS_TO_MS = 0.01;

const round3 = (v) => Math.round(v * 1000) / 1000;

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const normKey = (s) =>
  String(s ?? '').replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');

function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const header = rows[0].map(normKey);
  return rows
    .slice(1)
    .map((cells) => {
      const obj = {};
      header.forEach((key, i) => {
        if (key) obj[key] = String(cells[i] ?? '').trim();
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v !== ''));
}

// Accepts only values whose first meaningful char is numeric/sign (~, >, < allowed).
// Rejects "LOW O2", "Insignificant", "n/a", "Complete" — never extracts a stray
// digit from a word.
function firstNum(value) {
  const s = String(value ?? '').replace(/^[~≈<>=\s]+/, '');
  if (!/^[-+\d.]/.test(s)) return null;
  const m = s.match(/-?\d+\.?\d*/);
  return m ? Number(m[0]) : null;
}

// All numbers in a list cell ("21; 26.5; 40"), skipping digits glued to
// letters ("O2", "C2H4", "N2").
function allNums(value) {
  const s = String(value ?? '');
  const out = [];
  const re = /-?\d+\.?\d*/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const prev = s[m.index - 1];
    if (prev != null && /[a-z]/i.test(prev)) continue;
    out.push(Number(m[0]));
  }
  return out;
}

function collect(rows, cols, { factor = 1, list = false, min = -Infinity, max = Infinity } = {}) {
  const out = [];
  for (const row of rows) {
    for (const col of cols) {
      const raw = row[normKey(col)];
      if (raw == null || raw === '') continue;
      const nums = list ? allNums(raw) : [firstNum(raw)].filter((v) => v != null);
      for (const n of nums) {
        const v = n * factor;
        if (Number.isFinite(v) && v >= min && v <= max) out.push(v);
      }
    }
  }
  return out;
}

const mixLabel = (row) => {
  if (firstNum(row['co initial ambient composition; mole fraction']) > 0) return 'CO2 dilution';
  if (firstNum(row['he initial ambient composition; mole fraction']) > 0) return 'He dilution';
  return 'O2/N2';
};

const PSI_TABLE_SPECS = [
  {
    match: 'PSI-69',
    acronym: 'FLEX',
    o2: { cols: ['O initial ambient composition; mole fraction'], factor: 100, max: 100 },
    pressure: { cols: ['Ambient pressure; mmHg'], factor: MMHG_TO_PSI, max: 300 },
    replaceSeries: true,
    series: [{
      name: 'burn_time_s', unit: 's', xLabel: 'Droplet initial diameter (mm)',
      x: 'Droplet initial diameter; mm', y: 'Burn time; s',
      group: (row) => `${row.fuel} · ${mixLabel(row)} (FLEX PSI-69)`,
    }],
    provenance: 'NASA PSI-69 FLEX Experimental table',
  },
  {
    match: 'PSI-25',
    acronym: 'BASS-II',
    o2: { cols: ['Calibrated initial O2 % by vol', 'Calibrated final O2 % by vol'], max: 100 },
    series: [
      {
        name: 'o2_consumed_pct_pts', unit: 'pct pts', xLabel: 'Test (table order)',
        x: null, y: (row) => {
          const a = firstNum(row['calibrated initial o2 % by vol']);
          const b = firstNum(row['calibrated final o2 % by vol']);
          return a != null && b != null ? a - b : null;
        },
        label: 'O2 consumed per test (BASS-II PSI-25)',
      },
      {
        name: 'co2_produced_pct_pts', unit: 'pct pts', xLabel: 'Test (table order)',
        x: null, y: (row) => {
          const a = firstNum(row['final co2 % by vol']);
          const b = firstNum(row['initial co2 % by vol']);
          return a != null && b != null ? a - b : null;
        },
        label: 'CO2 produced per test (BASS-II PSI-25)',
      },
    ],
    provenance: 'NASA PSI-25 BASS-II Experimental table',
  },
  {
    match: 'PSI-99',
    acronym: 'Saffire-II',
    o2: { cols: ['Percent O2 (Note 1)'], max: 100 },
    flow: { cols: ['Air Flow (cm/s)'], factor: CMS_TO_MS, max: 20 },
    series: [{
      name: 'ignition_time_s', unit: 's', xLabel: 'Air flow (cm/s)',
      x: 'Air Flow (cm/s)', y: 'Ignition Time (s)',
      label: 'Ignition time vs air flow (Saffire-II PSI-99)',
    }],
    provenance: 'NASA PSI-99 Saffire-II Experimental table',
  },
  {
    match: 'PSI-100',
    acronym: 'Saffire-III',
    flow: { cols: ['Air Flow'], factor: CMS_TO_MS, max: 20 },
    provenance: 'NASA PSI-100 Saffire-III Experimental table',
  },
  {
    match: 'PSI-159_Experimental table_CFI-G_Normal Flames.csv',
    acronym: 'CFI-G',
    o2: { cols: ['XO2 before test', 'XO2  after test'], factor: 100, max: 100 },
    pressure: { cols: ['approx p (bar)'], factor: BAR_TO_PSI, max: 300 },
    series: [{
      name: 'burn_time_s', unit: 's', xLabel: 'Chamber O2 (%)',
      x: 'XO2 before test', y: 'burn time (sec)', xFactor: 100,
      label: 'Burn time vs O2 (CFI-G PSI-159)',
    }],
    provenance: 'NASA PSI-159 CFI-G Normal Flames Experimental table',
  },
  {
    match: 'PSI-10',
    acronym: 'Flame Design',
    o2: { cols: ['XO2'], factor: 100, max: 100 },
    pressure: { cols: ['pmean (atm)'], factor: ATM_TO_PSI, max: 300 },
    series: [{
      name: 'adiabatic_flame_temp_k', unit: 'K', xLabel: 'O2 mole fraction (%)',
      x: 'XO2', y: 'Tad (K)', xFactor: 100,
      label: 'Adiabatic flame temp vs O2 (Flame Design PSI-10)',
    }],
    provenance: 'NASA PSI-10 Flame Design Experimental table',
  },
  {
    match: 'PSI-107',
    acronym: 'SPICE',
    flow: { cols: ['Air Rate (cm/s)'], factor: CMS_TO_MS, max: 20 },
    series: [{
      name: 'fuel_rate_mg_s', unit: 'mg/s', xLabel: 'Air rate (cm/s)',
      x: 'Air Rate (cm/s)', y: 'Fuel Rate (mg/s)',
      label: 'Fuel rate vs air rate (SPICE PSI-107)',
    }],
    provenance: 'NASA PSI-107 SPICE Experimental table',
  },
  {
    match: 'PSI-39',
    acronym: 'CFI',
    o2: { cols: ['Oxygen'], factor: 100, max: 100 },
    pressure: { cols: ['Pressure'], factor: ATM_TO_PSI, max: 300 },
    provenance: 'NASA PSI-39 CFI Experimental table',
  },
  {
    match: 'PSI-68',
    acronym: 'FLEX-2',
    o2: { cols: ['Oxygen Mole Fraction'], factor: 100, list: true, max: 100 },
    pressure: { cols: ['Ambient Pressure (atm)'], factor: ATM_TO_PSI, list: true, max: 300 },
    flow: { cols: ['Flow Velocity (cm/s)'], factor: CMS_TO_MS, list: true, max: 20 },
    provenance: 'NASA PSI-68 FLEX-2 test-matrix table',
  },
  {
    match: 'PSI-20',
    acronym: 'BRE',
    o2: { cols: ['Oxygen Conc (percent)'], list: true, max: 100 },
    provenance: 'NASA PSI-20 ACME BRE Experimental table',
  },
  {
    match: 'PSI-23',
    acronym: 's-Flame',
    o2: { cols: ['Atmosphere*'], max: 100 },
    provenance: 'NASA PSI-23 ACME s-Flame Experimental table',
  },
  {
    match: 'PSI-102',
    acronym: 'SAME',
    flow: { cols: ['Air Flow (cm/s)'], factor: CMS_TO_MS, max: 20 },
    series: [{
      name: 'weight_loss_rate_mg_min', unit: 'mg/min', xLabel: 'Air flow (cm/s)',
      x: 'Air Flow (cm/s)', y: 'Weight loss rate (mg/min)',
      label: 'Sample weight-loss rate vs air flow (SAME PSI-102)',
    }],
    provenance: 'NASA PSI-102 SAME Experimental table',
  },
  {
    match: 'PSI-101',
    acronym: 'SAME-R',
    flow: { cols: ['Inlet velocity (cm/s)'], factor: CMS_TO_MS, max: 20 },
    series: [{
      name: 'test_duration_s', unit: 's', xLabel: 'Inlet velocity (cm/s)',
      x: 'Inlet velocity (cm/s)', y: 'Duration (sec)',
      label: 'Test duration vs inlet velocity (SAME-R PSI-101)',
    }],
    provenance: 'NASA PSI-101 SAME-R Experimental table',
  },
  {
    match: 'PSI-21',
    acronym: 'CLD Flame',
    series: [{
      name: 'flames_ignited', unit: 'count', xLabel: 'Test day (table order)',
      x: null, y: 'Flames ignited',
      label: 'Flames ignited per test day (CLD PSI-21)',
    }],
    provenance: 'NASA PSI-21 CLD Flame Experimental table',
  },
  { match: 'PSI-26', acronym: 'BASS', provenance: 'NASA PSI-26 BASS Experimental table' },
  { match: 'PSI-106', acronym: 'SLICE', provenance: 'NASA PSI-106 SLICE Experimental table' },
];

const median = (vals) => {
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function buildSeries(rows, spec, sourceUrl, provenance) {
  const groups = new Map();
  for (const s of spec.series ?? []) {
    rows.forEach((row, idx) => {
      const yRaw = typeof s.y === 'function' ? s.y(row) : firstNum(row[normKey(s.y)]);
      if (yRaw == null || !Number.isFinite(yRaw)) return;
      const xVal = s.x == null ? idx + 1 : firstNum(row[normKey(s.x)]);
      if (xVal == null || !Number.isFinite(xVal)) return;
      const key = s.group ? s.group(row) : s.label;
      if (!groups.has(key)) groups.set(key, { spec: s, samples: [] });
      groups.get(key).samples.push([round3(xVal * (s.xFactor ?? 1)), round3(yRaw)]);
    });
  }
  return [...groups.entries()]
    .filter(([, g]) => g.samples.length > 0)
    .map(([label, g]) => ({
      name: g.spec.name,
      label,
      unit: g.spec.unit,
      xLabel: g.spec.xLabel,
      samples: g.samples.sort((a, b) => a[0] - b[0]),
      sourceUrl,
      seriesSource: provenance,
    }));
}

/**
 * Merge real PSI-table measurements into transformed docs.
 * @param {Array} docs transformed investigations (mutated in place)
 * @param {string} tablesDir directory holding the PSI CSV exports
 * @returns {Array<{acronym: string, rows: number, series: number}>} summary
 */
export async function enrichWithPsiTables(docs, tablesDir) {
  let files;
  try {
    files = (await readdir(tablesDir)).filter((f) => f.endsWith('.csv'));
  } catch {
    console.warn(
      '[psi-tables] CSV directory not found — skipping enrichment. ' +
        'Place the NASA PSI "Experimental table" exports under data/raw/psi-tables/ to enable it.'
    );
    return [];
  }
  const summary = [];

  for (const spec of PSI_TABLE_SPECS) {
    const file = files.find((f) => f === spec.match || f.startsWith(`${spec.match}_`));
    if (!file) continue;
    const doc = docs.find(
      (d) => String(d.acronym ?? '').toLowerCase() === spec.acronym.toLowerCase()
    );
    if (!doc) continue;

    const rows = rowsToObjects(parseCsv(await readFile(path.join(tablesDir, file), 'utf8')));
    if (!rows.length) continue;

    const psiNum = spec.match.match(/PSI-\d+/)?.[0] ?? spec.match;
    const sourceUrl = `${PSI_REPO}/${psiNum}`;
    doc.experimentRuns = rows.length;
    doc.sourceUrl = sourceUrl;

    const o2 = collect(rows, spec.o2?.cols ?? [], spec.o2 ?? {});
    if (o2.length) {
      doc.conditions.oxygenMinPct = round3(Math.min(...o2));
      doc.conditions.oxygenMaxPct = round3(Math.max(...o2));
      const nom = doc.conditions.oxygenPct;
      if (nom == null || nom < Math.min(...o2) || nom > Math.max(...o2)) {
        doc.conditions.oxygenPct = round3(median(o2));
      }
    }
    const pressure = collect(rows, spec.pressure?.cols ?? [], spec.pressure ?? {});
    if (pressure.length) doc.conditions.pressurePsi = round3(median(pressure));
    const flow = collect(rows, spec.flow?.cols ?? [], spec.flow ?? {});
    if (flow.length) doc.conditions.flowVelocity = round3(median(flow));

    const series = buildSeries(rows, spec, sourceUrl, spec.provenance);
    if (spec.replaceSeries) {
      doc.series = series;
      doc.seriesSource = spec.provenance;
    } else {
      if (series.length) {
        const existing = new Set(doc.series.map((s) => s.name));
        doc.series.push(...series.filter((s) => !existing.has(s.name)));
      }
      doc.seriesSource = [doc.seriesSource, spec.provenance].filter(Boolean).join('; ');
    }

    summary.push({ acronym: spec.acronym, rows: rows.length, series: series.length });
  }
  return summary;
}
