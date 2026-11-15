import { useEffect, useMemo, useState } from 'react';
import FlameVisualization, { TEST_SUBJECT_OPTIONS } from '../components/three/FlameVisualization.jsx';
import FlexCoverageMap from '../components/ui/FlexCoverageMap.jsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../services/api.js';
import {
  MIXTURE_OPTIONS,
  inferMixture,
  getMixtureEnvelope,
  getDynamicGasBounds,
  clampConditionsToEnvelope,
  updateMeterCondition,
  trialToConditions,
  evaluateSupportCoverage,
} from '../services/flex-coverage.js';
import '../styles/firehazr.css';

const EXAMPLE = {
  fuel: 'Methanol',
  pressure_mmhg: 765,
  o2_fraction: 0.21,
  n2_fraction: 0.79,
  co2_fraction: 0,
  he_fraction: 0,
  diameter_mm: 1.8,
};

const ELEVATED_FLEX_FLAMES = {
  fuel: 'Methanol',
  pressure_mmhg: 537.3,
  o2_fraction: 0.3,
  n2_fraction: 0.7,
  co2_fraction: 0,
  he_fraction: 0,
  diameter_mm: 2.6,
};

const SUIT_PRESETS = [
  {
    id: 'normal',
    label: 'Preset: Nominal (21% O₂)',
    color: '#10b981',
    suitState: 'normal',
    form: {
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
    id: 'flames',
    label: 'Preset: In Flames (30% O₂ · FLEX)',
    color: '#f59e0b',
    suitState: 'flames',
    form: ELEVATED_FLEX_FLAMES,
  },
  {
    id: 'burned',
    label: 'Preset: Burned / Flashover (85% O₂)',
    color: '#ef4444',
    suitState: 'burned',
    form: {
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

const CONDITION_STATES = [
  { id: 'auto', label: 'Auto (O₂%)', color: '#38bdf8' },
  { id: 'normal', label: 'Nominal', color: '#10b981' },
  { id: 'flames', label: 'In Flames', color: '#f59e0b' },
  { id: 'burned', label: 'Burned', color: '#ef4444' },
];

const FIELDS = [
  {
    key: 'pressure_mmhg',
    label: 'Pressure (mmHg)',
    min: 0.001,
    max: undefined,
    step: 'any',
    obsMin: 526.3,
    obsMax: 2319.7,
    rangeText: 'Required · > 0 (FLEX data: 526.3 – 2319.7 mmHg)',
    studentHint: 'Chamber air pressure (760 mmHg = 1 atm at sea level).',
  },
  {
    key: 'diameter_mm',
    label: 'Initial droplet diameter (mm)',
    min: 0.001,
    max: undefined,
    step: 'any',
    obsMin: 1.1,
    obsMax: 4.67,
    rangeText: 'Required · > 0 (FLEX data: 1.10 – 4.67 mm)',
    studentHint: 'Starting size of the liquid fuel droplet.',
  },
  {
    key: 'o2_fraction',
    label: 'O₂ mole fraction',
    min: 0,
    max: 1,
    step: 'any',
    obsMin: 0.12,
    obsMax: 0.34,
    rangeText: 'Required · 0 – 1 (FLEX data: 0.12 – 0.34)',
    studentHint: 'Share of oxygen molecules (0.21 = 21% Earth air).',
  },
  {
    key: 'n2_fraction',
    label: 'N₂ mole fraction',
    min: 0,
    max: 1,
    step: 'any',
    obsMin: 0.09,
    obsMax: 0.88,
    rangeText: 'Required · 0 – 1 (FLEX data: 0.09 – 0.88)',
    studentHint: 'Share of nitrogen gas (0.79 = 79% Earth air).',
  },
  {
    key: 'co2_fraction',
    label: 'CO₂ mole fraction',
    min: 0,
    max: 1,
    step: 'any',
    obsMin: 0,
    obsMax: 0.7,
    rangeText: 'Required · 0 – 1 (FLEX data: 0 – 0.70)',
    studentHint: 'Share of carbon dioxide diluent (0 for normal air).',
  },
  {
    key: 'he_fraction',
    label: 'He mole fraction',
    min: 0,
    max: 1,
    step: 'any',
    obsMin: 0,
    obsMax: 0.45,
    rangeText: 'Required · 0 – 1 (FLEX data: 0 – 0.45)',
    studentHint: 'Share of helium diluent (0 for normal air).',
  },
];

function validateFireHazRForm(form) {
  for (const field of FIELDS) {
    const raw = form[field.key];
    const num = Number(raw);
    if (String(raw ?? '').trim() === '' || !Number.isFinite(num)) {
      return `${field.label} is required. Enter a valid number (${field.rangeText}).`;
    }
    if (field.min != null && num < field.min) {
      return `${field.label} must be at least ${field.min} (entered: ${num}). ${field.rangeText}.`;
    }
    if (field.max != null && num > field.max) {
      return `${field.label} cannot exceed ${field.max} (entered: ${num}). Stop at ${field.max}.`;
    }
  }
  const gasSum =
    Number(form.o2_fraction) +
    Number(form.n2_fraction) +
    Number(form.co2_fraction) +
    Number(form.he_fraction);
  if (Math.abs(gasSum - 1) > 0.025) {
    const diff = gasSum - 1;
    const action =
      diff > 0
        ? `Reduce gas fractions by ${diff.toFixed(3)}`
        : `Increase gas fractions by ${Math.abs(diff).toFixed(3)}`;
    return `Gas mole fractions sum to ${gasSum.toFixed(3)}, which is outside the allowed range (0.975 – 1.025). ${action} so the total equals 1.000 (±0.025).`;
  }
  return '';
}

const REASONS = {
  respaldado: 'Conditions have experimental support.',
  fuera_de_rango_o_mezcla_sin_datos:
    'Outside the observed ranges, or no data for this fuel and mixture.',
  grupos_insuficientes:
    'Not enough independent experimental groups for this mixture.',
  sin_vecino_cercano_de_la_misma_mezcla:
    'No sufficiently close trial with the same fuel and gas mixture.',
};

// Exact observed FLEX v3 mixture envelopes from modelo.json (soporte)
const FLEX_ENVELOPES = {
  'Methanol | O₂/N₂': { pressure_mmhg: [534.3, 774.1], o2_fraction: [0.12, 0.34], n2_fraction: [0.66, 0.88], co2_fraction: [0, 0], he_fraction: [0, 0], diameter_mm: [1.61, 3.97] },
  'Heptane | O₂/N₂': { pressure_mmhg: [534.9, 771.4], o2_fraction: [0.13, 0.34], n2_fraction: [0.66, 0.86], co2_fraction: [0, 0], he_fraction: [0, 0], diameter_mm: [1.1, 4.67] },
  'Methanol | CO₂': { pressure_mmhg: [526.3, 2319.7], o2_fraction: [0.14, 0.25], n2_fraction: [0.09, 0.75], co2_fraction: [0.05, 0.7], he_fraction: [0, 0], diameter_mm: [1.66, 4.53] },
  'Heptane | CO₂': { pressure_mmhg: [531.1, 1553.8], o2_fraction: [0.17, 0.25], n2_fraction: [0.09, 0.75], co2_fraction: [0.05, 0.7], he_fraction: [0, 0], diameter_mm: [1.34, 4.14] },
  'Methanol | He': { pressure_mmhg: [527.6, 763.5], o2_fraction: [0.13, 0.24], n2_fraction: [0.38, 0.75], co2_fraction: [0, 0], he_fraction: [0.05, 0.45], diameter_mm: [1.84, 3.87] },
  'Heptane | He': { pressure_mmhg: [528.0, 766.5], o2_fraction: [0.16, 0.24], n2_fraction: [0.38, 0.71], co2_fraction: [0, 0], he_fraction: [0.1, 0.45], diameter_mm: [1.49, 3.78] },
};

function diagnoseOutOfRange(conditions) {
  if (!conditions) return { mixture: null, issues: [] };
  const hasCo2 = Number(conditions.co2_fraction) > 0.005;
  const hasHe = Number(conditions.he_fraction) > 0.005;
  if (hasCo2 && hasHe) {
    return {
      mixture: `${conditions.fuel} | CO₂ + He`,
      issues: ['Combined CO₂ + He mixtures have 0 trials in the FLEX dataset. Set either CO₂ or He to 0.'],
    };
  }
  const mixTag = hasCo2 ? 'CO₂' : hasHe ? 'He' : 'O₂/N₂';
  const mixture = `${conditions.fuel} | ${mixTag}`;
  const env = FLEX_ENVELOPES[mixture];
  if (!env) return { mixture, issues: [`No FLEX data for ${mixture}.`] };
  const labels = {
    pressure_mmhg: 'Pressure (mmHg)',
    o2_fraction: 'O₂ fraction',
    n2_fraction: 'N₂ fraction',
    co2_fraction: 'CO₂ fraction',
    he_fraction: 'He fraction',
    diameter_mm: 'Droplet diameter (mm)',
  };
  const issues = [];
  for (const [k, [min, max]] of Object.entries(env)) {
    const val = Number(conditions[k]);
    if (val < min) issues.push(`${labels[k]} = ${val} is below the ${mixture} minimum (${min}).`);
    else if (val > max) issues.push(`${labels[k]} = ${val} exceeds the ${mixture} maximum (${max}).`);
  }
  return { mixture, issues };
}

function MeterSlider({
  label,
  valueDisplay,
  min,
  max,
  step,
  value,
  onChange,
  accentColor = '#38bdf8',
  minLabel,
  maxLabel,
  hint,
}) {
  const clampedValue = Math.min(max, Math.max(min, Number(value) || min));
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        padding: '9px 11px',
        borderRadius: '8px',
        background: '#080f1c',
        border: '1px solid #1e293b',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>{label}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#f8fafc',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {valueDisplay}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={clampedValue}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor, cursor: 'pointer', margin: 0 }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '9.5px',
          fontFamily: 'var(--font-mono)',
          color: '#64748b',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{minLabel ?? min}</span>
        {hint && <span style={{ color: '#8896ad', textAlign: 'center' }}>{hint}</span>}
        <span>{maxLabel ?? max}</span>
      </div>
    </div>
  );
}

export default function FireHazRPage({ compact = false, embedded = false }) {
  const { scenario, focusPlanet } = useApp();
  const isStudent = false;
  const [form, setForm] = useState(EXAMPLE);
  const [mixtureMode, setMixtureMode] = useState(() => inferMixture(EXAMPLE));
  const [metadata, setMetadata] = useState(null);
  const [presetsData, setPresetsData] = useState({ source: 'local', presets: [] });
  const [selectedPresetId, setSelectedPresetId] = useState('flex-published');
  const [response, setResponse] = useState(null);
  const [submittedConditions, setSubmittedConditions] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewerMode, setViewerMode] = useState('astronaut');
  const [suitState, setSuitState] = useState('auto');

  useEffect(() => {
    let active = true;
    api
      .firehazrMetadata()
      .then((data) => {
        if (active) setMetadata(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    api
      .firehazrPresets()
      .then((data) => {
        if (active && Array.isArray(data?.presets)) setPresetsData(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const availablePresets =
    presetsData.presets.length > 0
      ? presetsData.presets
      : SUIT_PRESETS.map((p) => ({
          id: p.id,
          label: p.label,
          suitState: p.suitState,
          note: 'Local NASA FLEX preset.',
          conditions: p.form,
          study: null,
        }));
  const activePreset = availablePresets.find((p) => p.id === selectedPresetId) ?? null;

  const resetResultsState = () => {
    setResponse(null);
    setInterpretation(null);
    setInterpretError(null);
    setError('');
  };

  const updateMeter = (key, value) => {
    setForm((current) => updateMeterCondition(current, mixtureMode, key, value));
    if (key === 'o2_fraction') {
      setSuitState('auto');
    }
    setSelectedPresetId('');
    resetResultsState();
  };

  const handleFuelChange = (nextFuel) => {
    setForm((current) => clampConditionsToEnvelope(current, nextFuel, mixtureMode));
    setSuitState('auto');
    setSelectedPresetId('');
    resetResultsState();
  };

  const handleMixtureChange = (nextMix) => {
    setMixtureMode(nextMix);
    setForm((current) => clampConditionsToEnvelope(current, current.fuel, nextMix));
    setSuitState('auto');
    setSelectedPresetId('');
    resetResultsState();
  };

  const applyTrial = (trial) => {
    if (!trial) return;
    const nextConditions = trialToConditions(trial);
    setMixtureMode(inferMixture(nextConditions));
    setForm(nextConditions);
    setSuitState('auto');
    setSelectedPresetId('');
    resetResultsState();
  };

  const applyPreset = (preset) => {
    if (!preset) return;
    const nextConditions = preset.conditions ?? preset.form;
    setSelectedPresetId(preset.id);
    setMixtureMode(inferMixture(nextConditions));
    setForm(nextConditions);
    if (viewerMode === 'spherical' || viewerMode === 'teardrop') {
      setViewerMode('astronaut');
    }
    setSuitState(preset.suitState ?? 'auto');
    resetResultsState();
  };

  const runGeminiInterpretation = (conditions, resultObj) => {
    if (!resultObj?.aceptado) return;
    setInterpreting(true);
    setInterpretError(null);
    api
      .interpretFirehazr({
        conditions,
        result: resultObj,
        study: activePreset?.study ?? null,
      })
      .then((interp) => {
        setInterpretation(interp);
        setInterpretError(null);
      })
      .catch((err) => {
        setInterpretation(null);
        const rawMsg = err?.message ?? 'Gemini service unavailable.';
        const isHighDemand = /503|high demand|UNAVAILABLE|overloaded/i.test(rawMsg);
        const isQuota = /429|quota|RESOURCE_EXHAUSTED|budget limit/i.test(rawMsg);
        setInterpretError({
          isHighDemand,
          isQuota,
          title: isHighDemand
            ? 'Gemini temporarily busy (503)'
            : isQuota
              ? 'Gemini quota / token limit (429)'
              : 'AI interpretation unavailable',
          detail: isHighDemand
            ? 'Google AI Studio is experiencing a temporary spike in demand. Your FireHazR result above is valid — try again in a few seconds.'
            : isQuota
              ? 'The API token budget or rate limit was reached. No extra tokens were spent.'
              : rawMsg,
        });
      })
      .finally(() => setInterpreting(false));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validateFireHazRForm(form);
    if (validationError) {
      setError(validationError);
      setResponse(null);
      setInterpretation(null);
      setInterpretError(null);
      return;
    }
    setLoading(true);
    setError('');
    setResponse(null);
    setInterpretation(null);
    setInterpretError(null);
    const conditions = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        key === 'fuel' ? value : Number(value),
      ])
    );
    setSubmittedConditions(conditions);
    try {
      const resData = await api.predictFirehazr(conditions);
      setResponse(resData);
      if (resData?.result?.aceptado) {
        runGeminiInterpretation(conditions, resData.result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const result = response?.result;
  const gasSum =
    (Number(form.o2_fraction) || 0) +
    (Number(form.n2_fraction) || 0) +
    (Number(form.co2_fraction) || 0) +
    (Number(form.he_fraction) || 0);
  const gasSumValid = Math.abs(gasSum - 1) <= 0.025;
  const liveCoverage = useMemo(() => evaluateSupportCoverage(form), [form]);
  const activeEnv = useMemo(
    () => getMixtureEnvelope(form.fuel, mixtureMode),
    [form.fuel, mixtureMode]
  );
  const gasBounds = useMemo(
    () => getDynamicGasBounds(form, mixtureMode),
    [form, mixtureMode]
  );
  const o2Pct = Math.round((Number(form.o2_fraction) || 0) * 100);
  const n2Pct = Math.round((Number(form.n2_fraction) || 0) * 100);
  const liveDiag = diagnoseOutOfRange(form);
  const flexBoundsOk = liveDiag.issues.length === 0 && gasSumValid && liveCoverage.supported;
  const effectiveSuitState =
    suitState !== 'auto'
      ? suitState
      : o2Pct >= 32 || (result?.aceptado && result?.duracion_estimada_s >= 15)
        ? 'burned'
        : o2Pct >= 25 || (result?.aceptado && result?.duracion_estimada_s > 0)
          ? 'flames'
          : 'normal';

  const activeSubject = TEST_SUBJECT_OPTIONS.find((opt) => opt.id === viewerMode) ?? TEST_SUBJECT_OPTIONS[0];
  const suitBadge =
    effectiveSuitState === 'burned'
      ? { label: `BURNED / CHARRED · ${activeSubject.label.toUpperCase()}`, color: '#ef4444' }
      : effectiveSuitState === 'flames'
        ? { label: `GROWING FLAMES (${o2Pct}% O₂)`, color: '#f59e0b' }
        : { label: `NOMINAL (<25% O₂)`, color: '#10b981' };

  return (
    <section
      className={`firehazr-page${compact ? ' firehazr-page--compact' : ''}${
        embedded ? ' firehazr-page--embedded' : ''
      }`}
    >
      <header>
        <h1>FireHazR test lab</h1>
        <p>
          Recorded droplet burn duration · KNN FLEX v3 · Experimental microgravity conditions
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderRadius: '8px',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid #263449',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: '#cbd5e1',
        }}
      >
        <span>
          <strong style={{ color: '#60a5fa' }}>Facility:</strong> ISS (EEI) · CIR / MDCA (0g)
        </span>
        <span>
          <strong style={{ color: '#93c5fd' }}>Mission:</strong> {scenario?.label ?? 'Moon base / rover'}
          {focusPlanet ? ` · Viewing: ${focusPlanet}` : ''}
        </span>
      </div>
      <p className="firehazr-notice">
        This model estimates recorded droplet burn duration from past NASA FLEX microgravity tests.
        It does not predict fire probability, ignition limits, suppression effectiveness, or safety,
        and cannot simulate a planetary environment. Ar and Xe are not supported.
      </p>

      <details className="firehazr-context" open={!compact}>
        <summary>What are these tests &amp; why do they matter? (NASA PSI Context)</summary>
        <p>
          <strong>Why study fire in space:</strong> In microgravity (free fall), there is no buoyancy
          to lift hot gases, so flames form spherical diffusion clouds instead of flickering teardrops.
          Fire alarms during Artemis II and historic incidents (Apollo 1, Apollo 13, Mir) show why
          spacecraft fire safety relies on three pillars: <strong>prevention</strong>,{' '}
          <strong>detection</strong>, and <strong>suppression</strong>.
        </p>
        <p>
          <strong>What FireHazR tests (Suppression &amp; Diluents):</strong> NASA&apos;s{' '}
          <strong>FLEX / FLEX-2</strong> experiments burned liquid droplets (Methanol and Heptane)
          inside the ISS Combustion Integrated Rack (<strong>CIR / MDCA</strong>) while diluting the
          chamber with <strong>CO₂</strong> and <strong>He</strong> to measure how gas mixture,
          pressure, and droplet size change burn duration.
        </p>
        <p>
          <strong>Why O₂ &amp; pressure matter for Moon &amp; Mars:</strong> Spacesuits run at{' '}
          <strong>100% O₂ / 4.3 psi</strong> (vs. Earth&apos;s 21% O₂ / 14.7 psi). To cut astronaut
          pre-breathing time, Moon bases and pressurized rovers will likely use{' '}
          <strong>≥30% O₂ at ≤10.2 psi</strong>—over 40% more oxygen than Earth air, making
          materials far more flammable.
        </p>
        <p>
          <strong>Other NASA PSI test families:</strong>{' '}
          <strong>BASS / BASS-II</strong> &amp; <strong>Saffire-I/II/III</strong> (solid fabric &amp;
          plastic flammability in MSG/SPICE and Cygnus), <strong>ACME</strong> (6 gas-flame studies
          in CIR including <strong>BRE</strong>, <strong>CFI-G</strong> up to 85% O₂, and{' '}
          <strong>E-FIELD Flames</strong> as an electric-field partial-gravity proxy), and{' '}
          <strong>SAME / SAME-R</strong> (smoke particle detection; instrument reused in{' '}
          <strong>DAFT / DAFT-2</strong> for dust). Direct lunar/Martian partial-gravity data is
          not yet in PSI (future <strong>LUCI</strong> &amp; <strong>FM2</strong>), so 0g and 1g
          tests bound intermediate risk.
        </p>
      </details>

      {/* 3D Astronaut Suit & Flame Test Chamber with One-Click Suit Presets */}
      <div
        className="tri-card"
        style={{
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: '#0c1422',
          border: '1px solid #263449',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#f8fafc',
              }}
            >
              3D MATERIAL &amp; VEHICLE FLAMMABILITY CHAMBER
            </span>
            <span
              style={{
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 7px',
                borderRadius: '4px',
                color: suitBadge.color,
                background: `${suitBadge.color}1f`,
                border: `1px solid ${suitBadge.color}55`,
              }}
            >
              {suitBadge.label}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            {/* One-Click Test Subject Selector Pills */}
            <div
              role="group"
              aria-label="3D test subject model"
              style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}
            >
              {TEST_SUBJECT_OPTIONS.map((opt) => {
                const active = viewerMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setViewerMode(opt.id)}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: active ? 700 : 500,
                      padding: '4px 8px',
                      borderRadius: '5px',
                      border: active ? '1px solid #38bdf8' : '1px solid #1c2640',
                      background: active ? 'rgba(56, 189, 248, 0.16)' : '#080f1c',
                      color: active ? '#e0f2fe' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* One-Click Status Selector Pills (Nominal / In Flames / Burned / Auto) */}
            <div
              role="group"
              aria-label="Test subject condition state"
              style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}
            >
              <span
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                  marginRight: '2px',
                }}
              >
                Status:
              </span>
              {CONDITION_STATES.map((st) => {
                const active = suitState === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSuitState(st.id);
                      if (viewerMode === 'spherical' || viewerMode === 'teardrop') {
                        setViewerMode('spacecraft-blue');
                      }
                    }}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: active ? 700 : 500,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: active ? `1px solid ${st.color}` : '1px solid #1c2640',
                      background: active ? `${st.color}22` : '#080f1c',
                      color: active ? st.color : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* MongoDB / NASA PSI Experimental Presets Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#cbd5e1' }}>
            <span>
              Load NASA PSI / FLEX Experimental Preset{' '}
              <small style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                ({presetsData.source === 'mongodb' ? 'MongoDB' : 'PSI Archive'})
              </small>
            </span>
            <select
              aria-label="Experimental preset"
              value={selectedPresetId}
              onChange={(e) => {
                const chosen = availablePresets.find((p) => p.id === e.target.value);
                if (chosen) applyPreset(chosen);
              }}
            >
              <option value="">Custom experimental conditions…</option>
              {availablePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {activePreset && (
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
              {activePreset.note}
              {activePreset.study?.title ? ` · Study: ${activePreset.study.acronym} (${activePreset.study.hardware ?? 'ISS'})` : ''}
            </p>
          )}
        </div>

        {/* Live Experimental Conditions Pill Header (synced with clamped meters below) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '6px',
            background: '#080f1c',
            border: '1px solid #1e293b',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>
            CHAMBER · <strong>{o2Pct}% O₂</strong> / {n2Pct}% N₂
            {Number(form.co2_fraction) > 0 ? ` / ${Math.round(Number(form.co2_fraction) * 100)}% CO₂` : ''}
            {Number(form.he_fraction) > 0 ? ` / ${Math.round(Number(form.he_fraction) * 100)}% He` : ''}
          </span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '9999px',
              fontSize: '9px',
              whiteSpace: 'nowrap',
              color: flexBoundsOk ? '#6ee7b7' : '#fde68a',
              background: flexBoundsOk ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.14)',
              border: flexBoundsOk ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(251, 191, 36, 0.35)',
            }}
          >
            {flexBoundsOk
              ? `In FLEX support (${liveCoverage.distance?.toFixed(2)} ≤ ${liveCoverage.limit?.toFixed(2)})`
              : liveCoverage.distance != null
                ? `Gap (${liveCoverage.distance.toFixed(2)} > ${liveCoverage.limit?.toFixed(2)})`
                : 'Out of FLEX range'}
          </span>
        </div>

        <div
          style={{
            height: compact ? '215px' : '250px',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #263449',
            position: 'relative',
          }}
        >
          <FlameVisualization
            type={viewerMode}
            oxygen={Math.max(10, o2Pct)}
            airflow={0.1}
            suitState={effectiveSuitState}
          />
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '10px',
              display: 'flex',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
            }}
          >
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(8, 15, 28, 0.85)',
                border: '1px solid #263449',
                color: '#38bdf8',
              }}
            >
              O₂: {o2Pct}% ({form.o2_fraction})
            </span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(8, 15, 28, 0.85)',
                border: '1px solid #263449',
                color: '#e2e8f0',
              }}
            >
              {form.pressure_mmhg} mmHg · {form.fuel}
            </span>
          </div>
        </div>
      </div>

      <div className="firehazr-layout">
        <form onSubmit={submit}>
          <h2>Experiment meters</h2>
          <fieldset disabled={loading} style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: 'none', padding: 0, margin: 0 }}>
            {/* Fuel & Gas Mixture Segmented Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#94a3b8' }}>Fuel</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {['Methanol', 'Heptane'].map((fuelOption) => {
                    const active = form.fuel === fuelOption;
                    return (
                      <button
                        key={fuelOption}
                        type="button"
                        onClick={() => handleFuelChange(fuelOption)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '7px',
                          border: active ? '1px solid #38bdf8' : '1px solid #1e293b',
                          background: active ? 'rgba(56, 189, 248, 0.14)' : '#080f1c',
                          color: active ? '#f0f9ff' : '#94a3b8',
                          fontSize: '12px',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {fuelOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#94a3b8' }}>
                  Atmosphere mixture ({activeEnv.count} FLEX trials)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {MIXTURE_OPTIONS.map((opt) => {
                    const active = mixtureMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleMixtureChange(opt.id)}
                        style={{
                          padding: '7px 6px',
                          borderRadius: '7px',
                          border: active ? '1px solid #38bdf8' : '1px solid #1e293b',
                          background: active ? 'rgba(56, 189, 248, 0.14)' : '#080f1c',
                          color: active ? '#f0f9ff' : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bounded Experimental Meters (clamped strictly to active FLEX limits) */}
            <MeterSlider
              label="Chamber Pressure"
              valueDisplay={`${Number(form.pressure_mmhg).toFixed(1)} mmHg (${(Number(form.pressure_mmhg) / 760).toFixed(2)} atm)`}
              min={activeEnv.pressure[0]}
              max={activeEnv.pressure[1]}
              step={0.5}
              value={form.pressure_mmhg}
              onChange={(v) => updateMeter('pressure_mmhg', v)}
              accentColor="#38bdf8"
              minLabel={`${activeEnv.pressure[0]} mmHg`}
              maxLabel={`${activeEnv.pressure[1]} mmHg`}
            />

            <MeterSlider
              label="Oxygen (O₂)"
              valueDisplay={`${(Number(form.o2_fraction) * 100).toFixed(1)}% (${Number(form.o2_fraction).toFixed(3)})`}
              min={gasBounds.o2[0]}
              max={gasBounds.o2[1]}
              step={0.005}
              value={form.o2_fraction}
              onChange={(v) => updateMeter('o2_fraction', v)}
              accentColor={suitBadge.color}
              minLabel={`${Math.round(gasBounds.o2[0] * 100)}%`}
              maxLabel={`${Math.round(gasBounds.o2[1] * 100)}%`}
              hint="Balances N₂"
            />

            {mixtureMode === 'CO₂' && (
              <MeterSlider
                label="CO₂ Suppressant"
                valueDisplay={`${(Number(form.co2_fraction) * 100).toFixed(1)}% (${Number(form.co2_fraction).toFixed(3)})`}
                min={gasBounds.diluent[0]}
                max={gasBounds.diluent[1]}
                step={0.005}
                value={form.co2_fraction}
                onChange={(v) => updateMeter('co2_fraction', v)}
                accentColor="#a78bfa"
                minLabel={`${Math.round(gasBounds.diluent[0] * 100)}%`}
                maxLabel={`${Math.round(gasBounds.diluent[1] * 100)}%`}
                hint="Inert dilution"
              />
            )}

            {mixtureMode === 'He' && (
              <MeterSlider
                label="Helium (He) Diluent"
                valueDisplay={`${(Number(form.he_fraction) * 100).toFixed(1)}% (${Number(form.he_fraction).toFixed(3)})`}
                min={gasBounds.diluent[0]}
                max={gasBounds.diluent[1]}
                step={0.005}
                value={form.he_fraction}
                onChange={(v) => updateMeter('he_fraction', v)}
                accentColor="#2dd4bf"
                minLabel={`${Math.round(gasBounds.diluent[0] * 100)}%`}
                maxLabel={`${Math.round(gasBounds.diluent[1] * 100)}%`}
                hint="Inert dilution"
              />
            )}

            <MeterSlider
              label="Droplet Diameter"
              valueDisplay={`${Number(form.diameter_mm).toFixed(2)} mm`}
              min={activeEnv.diameter[0]}
              max={activeEnv.diameter[1]}
              step={0.01}
              value={form.diameter_mm}
              onChange={(v) => updateMeter('diameter_mm', v)}
              accentColor="#60a5fa"
              minLabel={`${activeEnv.diameter[0]} mm`}
              maxLabel={`${activeEnv.diameter[1]} mm`}
            />

            {/* Read-only Auto-Balanced Nitrogen Meter */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '7px 11px',
                borderRadius: '8px',
                background: '#060a14',
                border: '1px solid #1c2640',
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>N₂ balance (auto): <strong style={{ color: '#e2e8f0' }}>{(Number(form.n2_fraction) * 100).toFixed(1)}%</strong> ({Number(form.n2_fraction).toFixed(3)})</span>
                <span style={{ color: gasSumValid ? '#34d399' : '#f59e0b' }}>Σ = {gasSum.toFixed(3)}</span>
              </div>
              <div style={{ height: '4px', borderRadius: '999px', background: '#111827', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, Number(form.n2_fraction) * 100))}%`,
                    background: '#475569',
                  }}
                />
              </div>
            </div>

            {/* Interactive NASA FLEX Trial Coverage Scatter Map */}
            <FlexCoverageMap
              conditions={form}
              coverage={liveCoverage}
              onSelectTrial={applyTrial}
            />
          </fieldset>

          {!liveCoverage.supported && liveCoverage.nearestTrial && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: '11px',
                color: '#fde68a',
              }}
            >
              <span>
                Between NASA clusters (dist {liveCoverage.distance?.toFixed(2)} &gt; {liveCoverage.limit?.toFixed(2)}). Nearest: <strong>{liveCoverage.nearestTrial.p} mmHg · {Math.round(liveCoverage.nearestTrial.o2 * 100)}% O₂</strong>
              </span>
              <button
                type="button"
                onClick={() => applyTrial(liveCoverage.nearestTrial)}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fef3c7',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Snap to nearest FLEX trial
              </button>
            </div>
          )}

          <div className="firehazr-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Calculating…' : 'Run FireHazR'}
            </button>
          </div>
        </form>
        <section className="firehazr-result" aria-label="FireHazR result" aria-live="polite">
          <h2>Analysis</h2>
          {error && <p role="alert">{error}</p>}
          {loading && <p role="status">Evaluating experimental support…</p>}
          {!result && !loading && !error && (
            <p>Enter initial conditions and run the model. No result has been calculated.</p>
          )}
          {result && (() => {
            const diag = !result.aceptado ? diagnoseOutOfRange(submittedConditions) : null;
            return (
            <>
              <h3>
                {result.aceptado
                  ? 'Estimated recorded burn duration'
                  : 'No supported estimate'}
              </h3>
              {result.aceptado && result.duracion_estimada_s != null && (
                <p className="firehazr-value">
                  {result.duracion_estimada_s.toFixed(4)} <span>s</span>
                </p>
              )}
              <p>{REASONS[result.motivo] ?? result.motivo}</p>

              {/* Exact Parameter-Level Diagnostic on Abstention */}
              {diag && (diag.issues.length > 0 || diag.mixture) && (
                <div className="firehazr-diag">
                  <strong>Coverage diagnostic ({diag.mixture})</strong>
                  {diag.issues.length > 0 ? (
                    <ul>
                      {diag.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: '4px 0 0' }}>
                      Each individual parameter is within min/max bounds, but this exact
                      combination (e.g. {submittedConditions?.pressure_mmhg} mmHg +{' '}
                      {Math.round((Number(submittedConditions?.o2_fraction) || 0) * 100)}% O₂) has
                      no nearby recorded ISS trial (distance{' '}
                      {result.distancia_soporte?.toFixed(3) ?? 'N/A'} vs limit{' '}
                      {result.limite_soporte?.toFixed(3) ?? 'N/A'}).
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {liveCoverage.nearestTrial && (
                      <button
                        type="button"
                        onClick={() => applyTrial(liveCoverage.nearestTrial)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.45)',
                          background: 'rgba(56, 189, 248, 0.14)',
                          color: '#bae6fd',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Snap to nearest FLEX trial ({liveCoverage.nearestTrial.p} mmHg · {Math.round(liveCoverage.nearestTrial.o2 * 100)}% O₂)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMixtureMode('O₂/N₂');
                        setForm(ELEVATED_FLEX_FLAMES);
                        setSelectedPresetId('lunar-30');
                        setSuitState('auto');
                        resetResultsState();
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        background: 'rgba(245, 158, 11, 0.14)',
                        color: '#fde68a',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Load 30% O₂ FLEX trial (537.3 mmHg)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMixtureMode('O₂/N₂');
                        setForm(EXAMPLE);
                        setSelectedPresetId('flex-published');
                        setSuitState('auto');
                        resetResultsState();
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(96, 165, 250, 0.45)',
                        background: 'rgba(59, 130, 246, 0.16)',
                        color: '#bfdbfe',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Load valid FLEX trial (21% O₂, 765 mmHg)
                    </button>
                  </div>
                  {Number(submittedConditions?.o2_fraction) > 0.34 && (
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>
                      <strong>Why the suit burns here even though FLEX abstains:</strong> FLEX liquid-droplet
                      trials stop at 34% O₂. Higher oxygen regimes (35–85% O₂) correspond to NASA PSI
                      gaseous-flame studies such as <strong>ACME / CFI-G</strong> (up to 85% O₂ in CIR) and{' '}
                      <strong>EVA spacesuit atmospheres</strong> (100% O₂ at 4.3 psi).
                    </p>
                  )}
                </div>
              )}

              {/* Post-Test Conditions & Coverage Summary */}
              {submittedConditions && (
                <div className="firehazr-summary-grid">
                  <div><span>Fuel</span><strong>{submittedConditions.fuel}</strong></div>
                  <div><span>Pressure</span><strong>{submittedConditions.pressure_mmhg} mmHg</strong></div>
                  <div><span>Diameter</span><strong>{submittedConditions.diameter_mm} mm</strong></div>
                  <div><span>O₂ / N₂</span><strong>{submittedConditions.o2_fraction} / {submittedConditions.n2_fraction}</strong></div>
                  <div><span>CO₂ / He</span><strong>{submittedConditions.co2_fraction} / {submittedConditions.he_fraction}</strong></div>
                  <div>
                    <span>FLEX coverage</span>
                    <strong>
                      {result.cobertura_mezcla ?? 0} trials ({result.grupos_mezcla ?? 0} groups)
                    </strong>
                  </div>
                </div>
              )}

              {/* Gemini AI Technical Interpretation */}
              <div className="firehazr-gemini-box">
                <div className="firehazr-gemini-box__head">
                  <strong>Technical Interpretation</strong>
                  <span className="firehazr-gemini-badge">
                    ✦ Powered by Gemini
                    {interpretation?.usage?.totalTokenCount
                      ? ` · ${interpretation.usage.totalTokenCount} tok`
                      : ''}
                  </span>
                </div>
                {!result.aceptado && (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                    AI analysis skipped — conditions are outside FLEX experimental bounds (0 tokens used).
                  </p>
                )}
                {result.aceptado && interpreting && (
                  <p style={{ margin: 0, color: '#94a3b8', fontStyle: 'italic' }}>
                    Analyzing test parameters &amp; NASA PSI context with Gemini…
                  </p>
                )}
                {result.aceptado && !interpreting && interpretation?.interpretation && (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {interpretation.interpretation}
                  </p>
                )}
                {result.aceptado && !interpreting && !interpretation && interpretError && (
                  <div
                    role="alert"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: interpretError.isHighDemand
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      border: interpretError.isHighDemand
                        ? '1px solid rgba(251, 191, 36, 0.35)'
                        : '1px solid rgba(248, 113, 113, 0.35)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <strong
                        style={{
                          fontSize: '12px',
                          color: interpretError.isHighDemand ? '#fde68a' : '#fca5a5',
                        }}
                      >
                        {interpretError.title}
                      </strong>
                      <button
                        type="button"
                        onClick={() => runGeminiInterpretation(submittedConditions, result)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '6px',
                          border: '1px solid rgba(148, 163, 184, 0.35)',
                          background: 'rgba(15, 23, 42, 0.75)',
                          color: '#e2e8f0',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ↻ Retry AI
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>
                      {interpretError.detail}
                    </p>
                  </div>
                )}
              </div>

              <details>
                <summary>Experimental support</summary>
                <p>
                  Same-mixture support distance:{' '}
                  {result.distancia_soporte == null
                    ? 'Unavailable'
                    : result.distancia_soporte.toFixed(4)}
                </p>
                <p>
                  Learned distance limit:{' '}
                  {result.limite_soporte == null
                    ? 'Unavailable'
                    : result.limite_soporte.toFixed(4)}
                </p>
                <p>
                  These are coverage rules, not a confidence interval or safety threshold.
                </p>
              </details>
              {result.vecinos?.length > 0 && (
                <details>
                  <summary>Neighboring trials ({result.vecinos.length})</summary>
                  <div className="firehazr-table">
                    <table>
                      <thead>
                        <tr>
                          <th>FLEX trial</th>
                          <th>Fuel</th>
                          <th>Recorded outcome</th>
                          <th>Observed duration (s)</th>
                          <th>Weight</th>
                          <th>Distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.vecinos.map((trial) => (
                          <tr key={trial.prueba}>
                            <td>{trial.prueba}</td>
                            <td>{trial.fuel}</td>
                            <td>{trial.fin_ensayo}</td>
                            <td>{trial.observado_s}</td>
                            <td>{trial.peso.toFixed(4)}</td>
                            <td>{trial.distancia.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              <details>
                <summary>Model provenance</summary>
                <p>{response.model}</p>
                <p>{response.limitation}</p>
                <a href={response.source_url} target="_blank" rel="noreferrer">
                  NASA FLEX source
                </a>
                <p className="firehazr-hash">
                  Training source SHA-256: {response.training_sha256}
                </p>
              </details>
            </>
            );
          })()}
        </section>
      </div>
      {metadata && (
        <details>
          <summary>Published validation and limitations</summary>
          <p>
            {metadata.training_trials} training trials · {metadata.training_groups} experimental
            groups. These are out-of-sample metrics supplied with the model, not a new evaluation
            of this query.
          </p>
          {Object.entries(metadata.validation).map(([name, stats]) => (
            <p key={name}>
              {name === 'grouped' ? 'Grouped holdout' : 'Chronological holdout'}:{' '}
              {stats.supported}/{stats.evaluated} supported predictions; MAE on that supported
              subset: {stats.mae_s.toFixed(2)} s.
            </p>
          ))}
          <p>
            Chronological support is limited; these results do not demonstrate general forecasting
            capability. Unsupported queries are not assigned a duration.
          </p>
        </details>
      )}
    </section>
  );
}
