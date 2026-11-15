import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const seriesSchema = new Schema(
  {
    name: String,              // e.g. "flame_spread_rate"
    unit: String,
    samples: [[Number]],       // [t, value] pairs
    sourceUrl: String,         // PSI file / dataset link
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
    gravityLevel: { type: String, enum: ['microgravity', 'lunar', 'martian', '1g', 'unknown'], default: 'unknown' },
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
