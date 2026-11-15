import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_STORAGE_KEY,
  TOUR_STEPS,
  readOnboardingDone,
  writeOnboardingDone,
  shouldAutoStartOnboarding,
} from '../src/utils/onboarding-storage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
  };
}

test('onboarding persistence stores and clears completion in storage', () => {
  const storage = createMemoryStorage();
  assert.equal(readOnboardingDone(storage), false);

  assert.equal(writeOnboardingDone(true, storage), true);
  assert.equal(storage.getItem(ONBOARDING_STORAGE_KEY), '1');
  assert.equal(readOnboardingDone(storage), true);

  assert.equal(writeOnboardingDone(false, storage), true);
  assert.equal(readOnboardingDone(storage), false);
});

test('onboarding auto-starts only on clean first visit to Mission Hub', () => {
  assert.equal(shouldAutoStartOnboarding({ pathname: '/', search: '', alreadyDone: false }), true);
  assert.equal(shouldAutoStartOnboarding({ pathname: '/', search: '', alreadyDone: true }), false);
  assert.equal(shouldAutoStartOnboarding({ pathname: '/studies', search: '', alreadyDone: false }), false);
  assert.equal(shouldAutoStartOnboarding({ pathname: '/', search: '?planet=Mars', alreadyDone: false }), false);
  assert.equal(shouldAutoStartOnboarding({ pathname: '/', search: '?tab=prediction', alreadyDone: false }), false);
});

test('tour steps walk the full application, stay grounded, and explain what modifies what', () => {
  assert.ok(TOUR_STEPS.length >= 8);
  const ids = new Set(TOUR_STEPS.map((s) => s.id));
  assert.equal(ids.size, TOUR_STEPS.length);

  const routes = new Set(TOUR_STEPS.map((s) => s.route));
  for (const requiredRoute of ['/', '/flame', '/studies', '/compare']) {
    assert.ok(routes.has(requiredRoute), `Missing route ${requiredRoute} in TOUR_STEPS`);
  }

  for (const step of TOUR_STEPS) {
    assert.ok(step.title.length > 0);
    assert.ok(step.description.length > 0);
    const fullText = `${step.description} ${step.changes ?? ''} ${step.why ?? ''}`;
    assert.ok(!/fire probability|safety score/i.test(fullText));
    if (step.target) {
      assert.ok(step.changes && step.changes.length > 10, `Step ${step.id} should explain what it modifies`);
      assert.ok(step.why && step.why.length > 10, `Step ${step.id} should explain why it matters`);
    }
  }
});
