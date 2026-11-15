import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const seriesSchema = new Schema(
  {
    name: String,              // e.g. "flame_spread_rate"
    label: String,             // human-readable series label
    unit: String,              // Y-axis unit
    xLabel: String,            // X-axis label & unit (default: Time (s))
    samples: [[Number]],       // [x, value] pairs
    sourceUrl: String,         // PSI file / dataset link
    seriesSource: String,      // Citation / artifact provenance
  },
  { _id: false }
);

const investigationSchema = new Schema(
  {
    psiId: { type: String, index: true, unique: true, sparse: true },
    title: { type: String, required: true, index: 'text' },
    acronym: String,           // BASS, Saffire, FLEX, ACME...
    objective: String,
    fuel: String,
    fuelType: {
      type: String,
      enum: ['solid', 'gas', 'droplet', 'aerosol', null],
      default: null,
    },
    hardware: String,          // CIR/ACME, CIR/MDCA, MSG with SPICE flow duct, etc.
    category: {
      type: String,
      enum: ['prevention', 'detection', 'suppression'],
      default: 'prevention',
    },
    gravityLevel: {
      type: String,
      enum: ['microgravity', 'lunar', 'lunar-partial', 'martian', '1g', 'unknown'],
      default: 'unknown',
    },
    status: {
      type: String,
      enum: ['published', 'upcoming'],
      default: 'published',
    },
    dataAvailable: { type: Boolean, default: true },
    conditions: {
      oxygenPct: Number,       // O2 concentration %
      oxygenMinPct: Number,    // Min tested O2 % if range is known
      oxygenMaxPct: Number,    // Max tested O2 % if range is known
      pressurePsi: Number,
      flowVelocity: Number,    // m/s
      ambient: String,         // e.g. "ISS cabin air"
    },
    variables: [String],
    sensors: [String],
    series: [seriesSchema],
    seriesSource: String,
    experimentRuns: Number,      // rows in the PSI experimental table for this study
    earthApplications: [String],
    // AI-generated (Devin SWE) — always marked with provenance
    aiSummary: String,
    aiSummaryModel: String,
    aiSummaryAt: Date,
    sourceUrl: String,
    tags: [String],
  },
  { timestamps: true }
);

export default model('Investigation', investigationSchema);
