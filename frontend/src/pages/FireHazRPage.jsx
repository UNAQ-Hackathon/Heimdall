import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import '../styles/firehazr.css';

const EXAMPLE = { fuel: 'Methanol', pressure_mmhg: 765, o2_fraction: 0.21, n2_fraction: 0.79, co2_fraction: 0, he_fraction: 0, diameter_mm: 1.8 };
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
  fuera_de_rango_o_mezcla_sin_datos: 'Outside the observed ranges, or no data for this fuel and mixture.',
  grupos_insuficientes: 'Not enough independent experimental groups for this mixture.',
  sin_vecino_cercano_de_la_misma_mezcla: 'No sufficiently close trial with the same fuel and gas mixture.',
};

export default function FireHazRPage({ compact = false }) {
  const [form, setForm] = useState(EXAMPLE);
  const [metadata, setMetadata] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.firehazrMetadata().then((data) => { if (active) setMetadata(data); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setResponse(null);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);
    const conditions = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key === 'fuel' ? value : Number(value)]));
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

  return (
    <section className={`firehazr-page${compact ? ' firehazr-page--compact' : ''}`}>
      <header>
        <h1>FireHazR test lab</h1>
        <p>Recorded droplet burn duration · KNN FLEX v3 · Experimental microgravity conditions</p>
      </header>
      <p className="firehazr-notice">This model does not predict fire probability, ignition limits, suppression effectiveness, or safety. It cannot simulate a planetary environment. Ar and Xe are not supported.</p>
      <div className="firehazr-layout">
        <form onSubmit={submit}>
          <h2>Initial conditions</h2>
          <fieldset disabled={loading}>
            <label>Fuel<select value={form.fuel} onChange={(event) => update('fuel', event.target.value)}><option>Methanol</option><option>Heptane</option></select></label>
            {FIELDS.map(([key, label, min, max, step]) => (
              <label key={key}>{label}<input required type="number" name={key} min={min} max={max} step={step} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>
            ))}
          </fieldset>
          <p className="firehazr-help">Gas values are mole fractions (0–1), not percentages. Their sum must be 1, with the source model's rounding tolerance of 0.025.</p>
          <div className="firehazr-actions">
            <button type="submit" disabled={loading}>{loading ? 'Calculating…' : 'Run FireHazR'}</button>
            <button type="button" disabled={loading} onClick={() => { setForm(EXAMPLE); setResponse(null); setError(''); }}>Load published example</button>
          </div>
        </form>
        <section className="firehazr-result" aria-label="FireHazR result" aria-live="polite">
          <h2>Analysis</h2>
          {error && <p role="alert">{error}</p>}
          {loading && <p role="status">Evaluating experimental support…</p>}
          {!result && !loading && !error && <p>Enter initial conditions and run the model. No result has been calculated.</p>}
          {result && (
            <>
              <h3>{result.aceptado ? 'Estimated recorded burn duration' : 'No supported estimate'}</h3>
              {result.aceptado && result.duracion_estimada_s != null && <p className="firehazr-value">{result.duracion_estimada_s.toFixed(4)} <span>s</span></p>}
              <p>{REASONS[result.motivo] ?? result.motivo}</p>
              <details><summary>Experimental support</summary>
                <p>Same-mixture support distance: {result.distancia_soporte == null ? 'Unavailable' : result.distancia_soporte.toFixed(4)}</p>
                <p>Learned distance limit: {result.limite_soporte == null ? 'Unavailable' : result.limite_soporte.toFixed(4)}</p>
                <p>These are coverage rules, not a confidence interval or safety threshold.</p>
              </details>
              {result.vecinos?.length > 0 && <details><summary>Neighboring trials ({result.vecinos.length})</summary>
                <div className="firehazr-table"><table><thead><tr><th>FLEX trial</th><th>Fuel</th><th>Recorded outcome</th><th>Observed duration (s)</th><th>Weight</th><th>Distance</th></tr></thead><tbody>
                  {result.vecinos.map((trial) => <tr key={trial.prueba}><td>{trial.prueba}</td><td>{trial.fuel}</td><td>{trial.fin_ensayo}</td><td>{trial.observado_s}</td><td>{trial.peso.toFixed(4)}</td><td>{trial.distancia.toFixed(4)}</td></tr>)}
                </tbody></table></div>
              </details>}
              <details><summary>Model provenance</summary><p>{response.model}</p><p>{response.limitation}</p><a href={response.source_url} target="_blank" rel="noreferrer">NASA FLEX source</a><p className="firehazr-hash">Training source SHA-256: {response.training_sha256}</p></details>
            </>
          )}
        </section>
      </div>
      {metadata && <details><summary>Published validation and limitations</summary>
        <p>{metadata.training_trials} training trials · {metadata.training_groups} experimental groups. These are out-of-sample metrics supplied with the model, not a new evaluation of this query.</p>
        {Object.entries(metadata.validation).map(([name, stats]) => <p key={name}>{name === 'grouped' ? 'Grouped holdout' : 'Chronological holdout'}: {stats.supported}/{stats.evaluated} supported predictions; MAE on that supported subset: {stats.mae_s.toFixed(2)} s.</p>)}
        <p>Chronological support is limited; these results do not demonstrate general forecasting capability. Unsupported queries are not assigned a duration.</p>
      </details>}
    </section>
  );
}
