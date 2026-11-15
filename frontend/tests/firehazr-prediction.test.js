import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLISHED_FLEX_QUERY, initialPredictionState, predictionReducer, parsePredictionConditions,
} from '../src/services/firehazr-prediction.js';

const returnedPrediction = { result: { aceptado: true, duracion_estimada_s: 5.128329932691694 } };

test('published FLEX conditions remain explicit and parse numeric form fields', () => {
  const form = Object.fromEntries(Object.entries(PUBLISHED_FLEX_QUERY).map(([key, value]) => [key, String(value)]));
  assert.deepEqual(parsePredictionConditions(form), PUBLISHED_FLEX_QUERY);
  assert.equal('planet' in PUBLISHED_FLEX_QUERY, false);
});

test('blank and non-finite numeric fields never silently become zero', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity']) {
    assert.throws(() => parsePredictionConditions({ ...PUBLISHED_FLEX_QUERY, pressure_mmhg: value }));
  }
});

test('request completion exposes only the actual response, without inventing progress or an estimate', () => {
  const running = predictionReducer(initialPredictionState, { type: 'start', requestId: 1 });
  assert.equal(running.phase, 'running');
  assert.equal(running.response, null);
  const complete = predictionReducer(running, { type: 'success', requestId: 1, response: returnedPrediction });
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.response, returnedPrediction);
});

test('changing conditions clears a previous estimate and invalidates an in-flight response', () => {
  const running = predictionReducer(initialPredictionState, { type: 'start', requestId: 1 });
  const changed = predictionReducer(running, { type: 'edit', patch: { pressure_mmhg: '100000' } });
  assert.equal(changed.phase, 'idle');
  assert.equal(changed.response, null);
  assert.equal(changed.form.pressure_mmhg, '100000');
  assert.equal(predictionReducer(changed, { type: 'success', requestId: 1, response: returnedPrediction }), changed);
  assert.equal(predictionReducer(changed, { type: 'error', requestId: 1, error: 'stale error' }), changed);
  const previous = { ...running, phase: 'complete', response: returnedPrediction };
  assert.equal(predictionReducer(previous, { type: 'edit', patch: { fuel: 'Heptane' } }).response, null);
});

test('only the latest request can replace the result', () => {
  const running = predictionReducer(initialPredictionState, { type: 'start', requestId: 2 });
  assert.equal(predictionReducer(running, { type: 'success', requestId: 1, response: returnedPrediction }), running);
});

test('unsupported queries retain the model abstention and never receive a fallback duration', () => {
  const running = predictionReducer(initialPredictionState, { type: 'start', requestId: 1 });
  const response = { result: { aceptado: false, duracion_estimada_s: null, motivo: 'fuera_de_rango_o_mezcla_sin_datos' } };
  const complete = predictionReducer(running, { type: 'success', requestId: 1, response });
  assert.equal(complete.response.result.duracion_estimada_s, null);
  assert.equal(complete.response, response);
});

test('failures expose an error instead of a local prediction; the example resets prior results', () => {
  const running = predictionReducer(initialPredictionState, { type: 'start', requestId: 1 });
  const failed = predictionReducer(running, { type: 'error', requestId: 1, error: 'Analytics unavailable' });
  assert.equal(failed.phase, 'error');
  assert.equal(failed.response, null);
  assert.equal(failed.error, 'Analytics unavailable');
  const reset = predictionReducer(failed, { type: 'example' });
  assert.deepEqual(reset.form, PUBLISHED_FLEX_QUERY);
  assert.equal(reset.error, '');
  assert.equal(reset.phase, 'idle');
});
