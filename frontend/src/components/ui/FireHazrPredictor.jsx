import { useEffect, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useSound } from '../../context/SoundContext.jsx';
import { api } from '../../services/api.js';
import {
  initialPredictionState,
  predictionReducer,
  parsePredictionConditions,
  PREDICTION_REASONS,
  PUBLISHED_FLEX_QUERY,
} from '../../services/firehazr-prediction.js';
import FireHazrResultChart from '../charts/FireHazrResultChart.jsx';
import '../../styles/firehazr-predictor.css';

const FIELDS = [
  ['pressure_mmhg', 'Pressure (mmHg)', 0.001, undefined, '1'],
  ['diameter_mm', 'Droplet diameter (mm)', 0.001, undefined, '0.1'],
  ['o2_fraction', 'O₂ fraction', 0, 1, '0.01'],
  ['n2_fraction', 'N₂ fraction', 0, 1, '0.01'],
  ['co2_fraction', 'CO₂ fraction', 0, 1, '0.01'],
  ['he_fraction', 'He fraction', 0, 1, '0.01'],
];

const STUDENT_PRESETS = [
  {
    id: 'iss-air',
    label: 'ISS Cabin Air (21% O₂)',
    hint: 'Earth-like station air, 1 atm',
    patch: PUBLISHED_FLEX_QUERY,
  },
  {
    id: 'co2-suppress',
    label: 'CO₂ Extinguisher (15% CO₂)',
    hint: 'Tests carbon dioxide flame suppression',
    patch: {
      fuel: 'Methanol',
      pressure_mmhg: 765,
      o2_fraction: 0.18,
      n2_fraction: 0.67,
      co2_fraction: 0.15,
      he_fraction: 0,
      diameter_mm: 2.8,
    },
  },
  {
    id: 'he-mix',
    label: 'Helium Mix (15% He)',
    hint: 'Tests lightweight helium thermal cooling',
    patch: {
      fuel: 'Methanol',
      pressure_mmhg: 760,
      o2_fraction: 0.18,
      n2_fraction: 0.67,
      co2_fraction: 0,
      he_fraction: 0.15,
      diameter_mm: 2.8,
    },
  },
];

const STUDENT_DROPLET_SIZES = [1.8, 2.8, 3.5];

export default function FireHazrPredictor() {
  const { scenario, focusPlanet, audience } = useApp();
  const sfx = useSound();
  const isStudent = audience === 'Student';
  const [state, dispatch] = useReducer(predictionReducer, initialPredictionState);
  const controllerRef = useRef(null);
  const sequenceRef = useRef(0);
  const { form, phase, response, error } = state;
  const result = response?.result;
  const running = phase === 'running';

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Prediction run audio: start blips, then success / abstain / error feedback.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'running') {
      sfx?.play('predict-start');
    } else if (prev === 'running' && phase === 'complete') {
      sfx?.play(result?.aceptado ? 'predict-success' : 'predict-abstain');
    } else if (prev === 'running' && phase === 'error') {
      sfx?.play('predict-error');
    }
  }, [phase, result, sfx]);

  const change = (type, patch) => {
    controllerRef.current?.abort();
    sequenceRef.current += 1;
    dispatch({ type, patch });
  };

  const submit = async (event) => {
    event.preventDefault();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++sequenceRef.current;
    dispatch({ type: 'start', requestId });
    try {
      const data = await api.predictFirehazr(parsePredictionConditions(form), { signal: controller.signal });
      if (
        !data?.result ||
        typeof data.result.aceptado !== 'boolean' ||
        (data.result.aceptado && !Number.isFinite(data.result.duracion_estimada_s))
      ) {
        throw new Error('The analytics service returned an invalid prediction. No estimate is available.');
      }
      if (!controller.signal.aborted) dispatch({ type: 'success', requestId, response: data });
    } catch (err) {
      if (!controller.signal.aborted) dispatch({ type: 'error', requestId, error: err.message });
    }
  };

  return (
    <section className="flex-predictor" aria-labelledby="flex-predictor-title">
      <header>
        <p className="flex-predictor__eyebrow">
          {isStudent ? 'Student Guided Lab · Zero-Gravity Droplet' : 'FireHazR / KNN FLEX v3'}
        </p>
        <h2 id="flex-predictor-title">
          {isStudent ? 'Test how space air changes burn time' : 'See the prediction'}
        </h2>
        <p>
          {isStudent
            ? 'Pick a cabin atmosphere recipe and droplet size, then run real NASA space station droplet data.'
            : 'Recorded droplet burn duration under the FLEX microgravity protocol. Inputs are not taken from the selected planet.'}
        </p>
        <p
          style={{
            marginTop: '6px',
            padding: '6px 8px',
            borderRadius: '6px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--audience-border, #263449)',
            fontSize: '10.5px',
            fontFamily: 'var(--font-mono)',
            color: '#cbd5e1',
          }}
        >
          <strong style={{ color: 'var(--audience-accent, #60a5fa)' }}>Facility:</strong> ISS · CIR/MDCA (0g) ·{' '}
          <strong style={{ color: '#93c5fd' }}>Mission:</strong> {scenario?.label ?? 'Moon base / rover'}
          {focusPlanet ? ` (${focusPlanet})` : ''}
        </p>
      </header>

      <form onSubmit={submit} noValidate>
        {isStudent ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#e2e8f0' }}>
                1. Choose a space atmosphere recipe
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {STUDENT_PRESETS.map((preset) => {
                  const active =
                    Number(form.o2_fraction) === preset.patch.o2_fraction &&
                    Number(form.co2_fraction) === preset.patch.co2_fraction &&
                    Number(form.he_fraction) === preset.patch.he_fraction;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => change('edit', preset.patch)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '7px',
                        border: active
                          ? '1px solid rgba(52, 211, 153, 0.6)'
                          : '1px solid #263449',
                        background: active ? 'rgba(16, 185, 129, 0.14)' : '#0b1322',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <strong style={{ fontSize: '12px' }}>{preset.label}</strong>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>{preset.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'end' }}>
              <label>
                2. Liquid Fuel
                <select value={form.fuel} onChange={(e) => change('edit', { fuel: e.target.value })}>
                  <option>Methanol</option>
                  <option>Heptane</option>
                </select>
              </label>

              <div>
                <span style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>
                  3. Droplet Size
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {STUDENT_DROPLET_SIZES.map((size) => {
                    const selected = Number(form.diameter_mm) === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => change('edit', { diameter_mm: size })}
                        style={{
                          flex: 1,
                          padding: '6px 4px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          border: selected ? '1px solid #34d399' : '1px solid #263449',
                          background: selected ? 'rgba(16, 185, 129, 0.16)' : '#0b1322',
                          color: selected ? '#d1fae5' : '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {size}mm
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <details style={{ fontSize: '11px', color: '#94a3b8' }}>
              <summary style={{ cursor: 'pointer', color: '#cbd5e1' }}>
                Edit exact gas fractions &amp; pressure ({Math.round(Number(form.o2_fraction) * 100)}% O₂, {form.pressure_mmhg} mmHg)
              </summary>
              <div className="flex-predictor__fields" style={{ marginTop: '8px' }}>
                {FIELDS.map(([key, label, min, max, step]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      required
                      min={min}
                      max={max}
                      step={step}
                      value={form[key]}
                      onChange={(e) => change('edit', { [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </details>

            <div className="flex-predictor__actions">
              <button type="submit" disabled={running}>
                {running ? 'Testing in Orbit…' : 'Predict Burn Time'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label>
              Fuel
              <select value={form.fuel} onChange={(e) => change('edit', { fuel: e.target.value })}>
                <option>Methanol</option>
                <option>Heptane</option>
              </select>
            </label>
            <div className="flex-predictor__fields">
              {FIELDS.map(([key, label, min, max, step]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    required
                    min={min}
                    max={max}
                    step={step}
                    value={form[key]}
                    onChange={(e) => change('edit', { [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <p className="flex-predictor__hint">
              Gas fractions use 0–1 and must sum to 1 (rounding tolerance: 0.025). Changing inputs clears the previous result.
            </p>
            <div className="flex-predictor__actions">
              <button type="submit" disabled={running}>
                {running ? 'Running query…' : 'Run prediction'}
              </button>
              <button type="button" onClick={() => change('example')}>
                Published example
              </button>
            </div>
          </>
        )}
      </form>

      <section className="flex-predictor__output" aria-label="Prediction execution" aria-busy={running}>
        <div role="status" aria-live="polite">
          {phase === 'idle' && (
            <p>
              {isStudent
                ? 'Choose a recipe above and click Predict Burn Time.'
                : 'Ready to run. No estimate has been calculated.'}
            </p>
          )}
          {running && <p className="flex-predictor__running">Waiting for the analytics response…</p>}
          {result && (
            <p>
              {result.aceptado
                ? isStudent
                  ? 'Space station data match found'
                  : 'Prediction returned'
                : 'Model abstained'}
            </p>
          )}
        </div>

        {error && <p role="alert">{error} No local prediction is substituted.</p>}

        {result && isStudent ? (
          <>
            {result.aceptado ? (
              <div
                className="flex-predictor__estimate"
                style={{ borderColor: 'rgba(52, 211, 153, 0.4)', background: 'rgba(16, 185, 129, 0.08)' }}
              >
                <span>Predicted microgravity burn duration</span>
                <strong>
                  {result.duracion_estimada_s.toFixed(2)} <small>seconds</small>
                </strong>
                <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#d1fae5', lineHeight: 1.45 }}>
                  Based on {result.vecinos?.length ?? 0} real ISS {form.fuel} droplet tests around{' '}
                  {Math.round(Number(form.o2_fraction) * 100)}% oxygen. Without upward gravity drafts,
                  droplets burn as slow, round glowing spheres.
                </p>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.09)',
                  fontSize: '12px',
                  color: '#fde68a',
                  lineHeight: 1.45,
                }}
              >
                <strong>No NASA test match:</strong> {PREDICTION_REASONS[result.motivo] ?? 'Outside tested ISS droplet bounds.'} The model refuses to guess outside real experiments.
              </div>
            )}

            <FireHazrResultChart result={result} conditions={form} />

            <details>
              <summary>Under the hood (KNN neighbors &amp; math)</summary>
              {result.vecinos?.length > 0 && (
                <ul className="flex-predictor__neighbors" style={{ marginTop: '6px' }}>
                  {result.vecinos.map((trial) => (
                    <li key={trial.prueba}>
                      <div>
                        <strong>Trial {trial.prueba}</strong>
                        <span>
                          {trial.observado_s} s observed / {(trial.peso * 100).toFixed(2)}% weight
                        </span>
                      </div>
                      <meter min="0" max="1" value={trial.peso} aria-label={`Trial ${trial.prueba} normalized weight`} />
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ fontSize: '11px', marginTop: '6px' }}>{response.limitation}</p>
            </details>
          </>
        ) : (
          result && (
            <>
              <ol className="flex-predictor__steps">
                <li>
                  <strong>1. Validate conditions</strong>
                  <span>Experimental inputs accepted by the service.</span>
                </li>
                <li>
                  <strong>2. Check experimental support</strong>
                  <span>{PREDICTION_REASONS[result.motivo] ?? 'The model did not report a recognized support reason.'}</span>
                </li>
                <li>
                  <strong>3. {result.aceptado ? 'Weight neighboring trials' : 'Withhold the estimate'}</strong>
                  <span>
                    {result.aceptado
                      ? `${result.vecinos?.length ?? 0} returned neighbors; inverse-distance weighting.`
                      : 'No supported duration is assigned.'}
                  </span>
                </li>
              </ol>
              {result.aceptado && (
                <div className="flex-predictor__estimate">
                  <span>Estimated recorded burn duration</span>
                  <strong>
                    {result.duracion_estimada_s.toFixed(4)} <small>s</small>
                  </strong>
                </div>
              )}
              {!result.aceptado && <h3>No supported estimate</h3>}
              <FireHazrResultChart result={result} conditions={form} />
              {result.vecinos?.length > 0 && (
                <details open>
                  <summary>Neighbor weights ({result.vecinos.length})</summary>
                  <p>Weights are contributions to the estimate, not fire-risk probabilities.</p>
                  <ul className="flex-predictor__neighbors">
                    {result.vecinos.map((trial) => (
                      <li key={trial.prueba}>
                        <div>
                          <strong>Trial {trial.prueba}</strong>
                          <span>
                            {trial.observado_s} s observed / {(trial.peso * 100).toFixed(2)}% weight
                          </span>
                        </div>
                        <meter min="0" max="1" value={trial.peso} aria-label={`Trial ${trial.prueba} normalized weight`} />
                      </li>
                    ))}
                  </ul>
                  <p>Estimate = Σ (normalized weight × observed duration). Values shown are rounded.</p>
                </details>
              )}
              <details open>
                <summary>Coverage diagnostics and provenance</summary>
                {result.cobertura_mezcla != null && (
                  <p>
                    Mixture support: {result.cobertura_mezcla} trials / {result.grupos_mezcla} experimental groups.
                  </p>
                )}
                {result.distancia_soporte != null && (
                  <p>
                    Support distance: {result.distancia_soporte.toFixed(4)} / learned limit:{' '}
                    {result.limite_soporte?.toFixed(4) ?? 'Unavailable'}.
                  </p>
                )}
                <p>{response.model}</p>
                <p>{response.limitation}</p>
                <a href={response.source_url} target="_blank" rel="noreferrer">
                  NASA FLEX source
                </a>
              </details>
            </>
          )
        )}

        <p className="flex-predictor__hint">
          {isStudent
            ? 'Shows real microgravity droplet burn duration only — never guesses flame risk outside tested NASA limits.'
            : 'The steps summarize the returned result; internal stages are not streamed live. No fire probability, suit-damage threshold, or planetary prediction is calculated.'}
        </p>
      </section>
      <Link className="flex-predictor__lab-link" to="/firehazr">
        {isStudent ? 'Explore the 3D Astronaut Flame Lab →' : 'Open the full FireHazR laboratory →'}
      </Link>
    </section>
  );
}
