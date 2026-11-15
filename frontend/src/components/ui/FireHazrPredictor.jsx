import { useEffect, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { api } from '../../services/api.js';
import {
  initialPredictionState, predictionReducer, parsePredictionConditions, PREDICTION_REASONS,
} from '../../services/firehazr-prediction.js';
import '../../styles/firehazr-predictor.css';

const FIELDS = [
  ['pressure_mmhg', 'Pressure (mmHg)', 0.001, undefined, '1'],
  ['diameter_mm', 'Droplet diameter (mm)', 0.001, undefined, '0.1'],
  ['o2_fraction', 'O₂ fraction', 0, 1, '0.01'],
  ['n2_fraction', 'N₂ fraction', 0, 1, '0.01'],
  ['co2_fraction', 'CO₂ fraction', 0, 1, '0.01'],
  ['he_fraction', 'He fraction', 0, 1, '0.01'],
];

export default function FireHazrPredictor() {
  const { scenario, focusPlanet } = useApp();
  const [state, dispatch] = useReducer(predictionReducer, initialPredictionState);
  const controllerRef = useRef(null);
  const sequenceRef = useRef(0);
  const { form, phase, response, error } = state;
  const result = response?.result;
  const running = phase === 'running';

  useEffect(() => () => controllerRef.current?.abort(), []);

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
      if (!data?.result || typeof data.result.aceptado !== 'boolean' ||
          (data.result.aceptado && !Number.isFinite(data.result.duracion_estimada_s))) {
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
        <p className="flex-predictor__eyebrow">FireHazR / KNN FLEX v3</p>
        <h2 id="flex-predictor-title">See the prediction</h2>
        <p>Recorded droplet burn duration under the FLEX microgravity protocol. Inputs are not taken from the selected planet.</p>
        <p
          style={{
            marginTop: '6px',
            padding: '6px 8px',
            borderRadius: '6px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid #263449',
            fontSize: '10.5px',
            fontFamily: 'var(--font-mono)',
            color: '#cbd5e1',
          }}
        >
          <strong style={{ color: '#60a5fa' }}>Facility:</strong> ISS (EEI) · CIR/MDCA (0g) ·{' '}
          <strong style={{ color: '#93c5fd' }}>Mission:</strong> {scenario?.label ?? 'Moon base / rover'}
          {focusPlanet ? ` (${focusPlanet})` : ''}
        </p>
      </header>
      <form onSubmit={submit} noValidate>
        <label>Fuel
          <select value={form.fuel} onChange={(e) => change('edit', { fuel: e.target.value })}>
            <option>Methanol</option><option>Heptane</option>
          </select>
        </label>
        <div className="flex-predictor__fields">
          {FIELDS.map(([key, label, min, max, step]) => (
            <label key={key}>{label}
              <input type="number" required min={min} max={max} step={step} value={form[key]}
                onChange={(e) => change('edit', { [key]: e.target.value })} />
            </label>
          ))}
        </div>
        <p className="flex-predictor__hint">Gas fractions use 0–1 and must sum to 1 (rounding tolerance: 0.025). Changing inputs clears the previous result.</p>
        <div className="flex-predictor__actions">
          <button type="submit" disabled={running}>{running ? 'Running query…' : 'Run prediction'}</button>
          <button type="button" onClick={() => change('example')}>Published example</button>
        </div>
      </form>
      <section className="flex-predictor__output" aria-label="Prediction execution" aria-busy={running}>
        <div role="status" aria-live="polite">
          {phase === 'idle' && <p>Ready to run. No estimate has been calculated.</p>}
          {running && <p className="flex-predictor__running">Waiting for the analytics response…</p>}
          {result && <p>{result.aceptado ? 'Prediction returned' : 'Model abstained'}</p>}
        </div>
        {error && <p role="alert">{error} No local prediction is substituted.</p>}
        {result && (
          <>
            <ol className="flex-predictor__steps">
              <li><strong>1. Validate conditions</strong><span>Experimental inputs accepted by the service.</span></li>
              <li><strong>2. Check experimental support</strong><span>{PREDICTION_REASONS[result.motivo] ?? 'The model did not report a recognized support reason.'}</span></li>
              <li><strong>3. {result.aceptado ? 'Weight neighboring trials' : 'Withhold the estimate'}</strong>
                <span>{result.aceptado ? `${result.vecinos?.length ?? 0} returned neighbors; inverse-distance weighting.` : 'No supported duration is assigned.'}</span>
              </li>
            </ol>
            {result.aceptado && <div className="flex-predictor__estimate"><span>Estimated recorded burn duration</span><strong>{result.duracion_estimada_s.toFixed(4)} <small>s</small></strong></div>}
            {!result.aceptado && <h3>No supported estimate</h3>}
            {result.vecinos?.length > 0 && (
              <details>
                <summary>Neighbor weights ({result.vecinos.length})</summary>
                <p>Weights are contributions to the estimate, not fire-risk probabilities.</p>
                <ul className="flex-predictor__neighbors">
                  {result.vecinos.map((trial) => (
                    <li key={trial.prueba}>
                      <div><strong>Trial {trial.prueba}</strong><span>{trial.observado_s} s observed / {(trial.peso * 100).toFixed(2)}% weight</span></div>
                      <meter min="0" max="1" value={trial.peso} aria-label={`Trial ${trial.prueba} normalized weight`} />
                    </li>
                  ))}
                </ul>
                <p>Estimate = Σ (normalized weight × observed duration). Values shown are rounded.</p>
              </details>
            )}
            <details>
              <summary>Coverage diagnostics and provenance</summary>
              {result.cobertura_mezcla != null && <p>Mixture support: {result.cobertura_mezcla} trials / {result.grupos_mezcla} experimental groups.</p>}
              {result.distancia_soporte != null && <p>Support distance: {result.distancia_soporte.toFixed(4)} / learned limit: {result.limite_soporte?.toFixed(4) ?? 'Unavailable'}.</p>}
              <p>{response.model}</p><p>{response.limitation}</p>
              <a href={response.source_url} target="_blank" rel="noreferrer">NASA FLEX source</a>
            </details>
          </>
        )}
        <p className="flex-predictor__hint">The steps summarize the returned result; internal stages are not streamed live. No fire probability, suit-damage threshold, or planetary prediction is calculated.</p>
      </section>
      <Link className="flex-predictor__lab-link" to="/firehazr">Open the full FireHazR laboratory →</Link>
    </section>
  );
}
