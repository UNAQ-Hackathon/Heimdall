import { useEffect, useState } from 'react';
import FlameVisualization from '../components/three/FlameVisualization.jsx';
import { api } from '../services/api.js';
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

const SUIT_PRESETS = [
  {
    id: 'normal',
    label: 'Preset: Nominal Suit (21% O₂)',
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
    label: 'Preset: Suit in Flames (35% O₂)',
    color: '#f59e0b',
    suitState: 'flames',
    form: {
      fuel: 'Heptane',
      pressure_mmhg: 527,
      o2_fraction: 0.35,
      n2_fraction: 0.65,
      co2_fraction: 0,
      he_fraction: 0,
      diameter_mm: 2.1,
    },
  },
  {
    id: 'burned',
    label: 'Preset: Burned Suit / Flashover (85% O₂)',
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

const FIELDS = [
  ['pressure_mmhg', 'Pressure (mmHg)', 0.001, undefined, 'any'],
  ['diameter_mm', 'Initial droplet diameter (mm)', 0.001, undefined, 'any'],
  ['o2_fraction', 'O₂ mole fraction', 0, 1, 'any'],
  ['n2_fraction', 'N₂ mole fraction', 0, 1, 'any'],
  ['co2_fraction', 'CO₂ mole fraction', 0, 1, 'any'],
  ['he_fraction', 'He mole fraction', 0, 1, 'any'],
];

const REASONS = {
  respaldado: 'Conditions have experimental support.',
  fuera_de_rango_o_mezcla_sin_datos:
    'Outside the observed ranges, or no data for this fuel and mixture.',
  grupos_insuficientes:
    'Not enough independent experimental groups for this mixture.',
  sin_vecino_cercano_de_la_misma_mezcla:
    'No sufficiently close trial with the same fuel and gas mixture.',
};

export default function FireHazRPage({ compact = false }) {
  const [form, setForm] = useState(EXAMPLE);
  const [metadata, setMetadata] = useState(null);
  const [response, setResponse] = useState(null);
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
    return () => {
      active = false;
    };
  }, []);

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'o2_fraction') {
        const o2 = Number(value);
        const co2 = Number(current.co2_fraction) || 0;
        const he = Number(current.he_fraction) || 0;
        if (Number.isFinite(o2) && o2 >= 0 && o2 <= 1) {
          next.n2_fraction = Math.max(0, Number((1 - o2 - co2 - he).toFixed(4)));
        }
      }
      return next;
    });
    if (key === 'o2_fraction') {
      setSuitState('auto');
    }
    setResponse(null);
    setError('');
  };

  const applyPreset = (preset) => {
    setForm(preset.form);
    setViewerMode('astronaut');
    setSuitState(preset.suitState);
    setResponse(null);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);
    const conditions = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        key === 'fuel' ? value : Number(value),
      ])
    );
    try {
      const result = await api.predictFirehazr(conditions);
      setResponse(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const result = response?.result;
  const o2Pct = Math.round((Number(form.o2_fraction) || 0) * 100);
  const effectiveSuitState =
    suitState !== 'auto'
      ? suitState
      : o2Pct >= 60
        ? 'burned'
        : o2Pct >= 25 || (result?.aceptado && result?.duracion_estimada_s > 0)
          ? 'flames'
          : 'normal';

  const suitBadge =
    effectiveSuitState === 'burned'
      ? { label: 'BURNED / CHARRED SUIT (≥60% O₂)', color: '#ef4444' }
      : effectiveSuitState === 'flames'
        ? { label: `GROWING FLAMES (${o2Pct}% O₂)`, color: '#f59e0b' }
        : { label: 'NOMINAL EVA SUIT (<25% O₂)', color: '#10b981' };

  return (
    <section className={`firehazr-page${compact ? ' firehazr-page--compact' : ''}`}>
      <header>
        <h1>FireHazR test lab</h1>
        <p>
          Recorded droplet burn duration · KNN FLEX v3 · Experimental microgravity conditions
        </p>
      </header>
      <p className="firehazr-notice">
        This model does not predict fire probability, ignition limits, suppression effectiveness, or
        safety. It cannot simulate a planetary environment. Ar and Xe are not supported.
      </p>

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
              3D EVA SUIT & FLAME CHAMBER
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

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[
              { id: 'astronaut', label: '3D Astronaut Suit' },
              { id: 'spherical', label: '0g Sphere' },
              { id: 'teardrop', label: '1g Plume' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewerMode(tab.id)}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: '5px',
                  background:
                    viewerMode === tab.id ? 'rgba(56, 189, 248, 0.2)' : '#080f1c',
                  border:
                    viewerMode === tab.id
                      ? '1px solid #38bdf8'
                      : '1px solid #263449',
                  color: viewerMode === tab.id ? '#38bdf8' : '#94a3b8',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* One-Click Presets to demonstrate Normal Suit, Suit in Flames, and Burned Suit */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {SUIT_PRESETS.map((preset) => {
            const isActive =
              viewerMode === 'astronaut' && effectiveSuitState === preset.suitState;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                style={{
                  padding: '5px 10px',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '6px',
                  background: isActive ? `${preset.color}22` : '#080f1c',
                  border: isActive
                    ? `1px solid ${preset.color}`
                    : '1px solid #263449',
                  color: isActive ? preset.color : '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Interactive O2 / Flame Growth Level Slider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: '#080f1c',
            border: '1px solid #1e293b',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#94a3b8',
              whiteSpace: 'nowrap',
            }}
          >
            FLAME LEVEL ({o2Pct}% O₂)
          </span>
          <input
            type="range"
            aria-label="Flame Oxygen Level"
            min="0.15"
            max="0.90"
            step="0.01"
            value={Math.min(0.9, Math.max(0.15, Number(form.o2_fraction) || 0.21))}
            onChange={(e) => update('o2_fraction', Number(e.target.value))}
            style={{ flex: 1, accentColor: suitBadge.color, cursor: 'pointer' }}
          />
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
          <h2>Initial conditions</h2>
          <fieldset disabled={loading}>
            <label>
              Fuel
              <select
                value={form.fuel}
                onChange={(event) => update('fuel', event.target.value)}
              >
                <option>Methanol</option>
                <option>Heptane</option>
              </select>
            </label>
            {FIELDS.map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  required
                  type="number"
                  name={key}
                  min={min}
                  max={max}
                  step={step}
                  value={form[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
          </fieldset>
          <p className="firehazr-help">
            Gas values are mole fractions (0–1), not percentages. Their sum must be 1, with the
            source model&apos;s rounding tolerance of 0.025.
          </p>
          <div className="firehazr-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Calculating…' : 'Run FireHazR'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setForm(EXAMPLE);
                setSuitState('auto');
                setResponse(null);
                setError('');
              }}
            >
              Load published example
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
          {result && (
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
          )}
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
