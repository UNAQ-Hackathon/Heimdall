import test from 'node:test';
import assert from 'node:assert/strict';
import { firehazrMetadata, predictFirehazr } from '../src/services/firehazr.service.js';

const conditions = { fuel: 'Methanol', pressure_mmhg: 765, o2_fraction: 0.21, n2_fraction: 0.79, co2_fraction: 0, he_fraction: 0, diameter_mm: 1.8 };

test('FireHazR proxy forwards explicit conditions and never substitutes a local score', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/api/analytics/firehazr/predict'));
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), conditions);
    return Response.json({ result: { aceptado: false, duracion_estimada_s: null } });
  });
  assert.deepEqual(await predictFirehazr(conditions), { result: { aceptado: false, duracion_estimada_s: null } });
});

test('FireHazR metadata uses GET', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/api/analytics/firehazr'));
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    return Response.json({ version: 3 });
  });
  assert.deepEqual(await firehazrMetadata(), { version: 3 });
});

test('missing prediction conditions remain a POST and are validated upstream', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.body, 'null');
    return Response.json({ detail: [{ msg: 'Field required' }] }, { status: 422 });
  });
  await assert.rejects(predictFirehazr(), (err) => err.status === 422 && err.details.validation.length === 1);
});

test('FireHazR service failure does not fabricate results', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await assert.rejects(predictFirehazr(conditions), (err) => err.status === 503);
});

test('FireHazR upstream errors and malformed success responses surface as errors', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Model unavailable' }, { status: 503 }));
  await assert.rejects(firehazrMetadata(), (err) => err.status === 502 && err.message === 'Model unavailable');
  stub.mock.mockImplementation(async () => new Response('not JSON'));
  await assert.rejects(firehazrMetadata(), (err) => err.status === 502);
});
