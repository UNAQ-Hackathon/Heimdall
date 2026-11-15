import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MOBILE_VIEWPORT_QUERY,
  isMobileViewport,
} from '../src/utils/use-mobile-viewport.js';

test('isMobileViewport safely handles SSR, matchMedia, and innerWidth fallback', () => {
  const originalWindow = globalThis.window;
  try {
    delete globalThis.window;
    assert.equal(isMobileViewport(), false);

    globalThis.window = {
      innerWidth: 390,
      matchMedia: (query) => ({
        matches: query === MOBILE_VIEWPORT_QUERY,
      }),
    };
    assert.equal(isMobileViewport(), true);

    globalThis.window = {
      innerWidth: 1280,
      matchMedia: () => ({ matches: false }),
    };
    assert.equal(isMobileViewport(), false);

    globalThis.window = { innerWidth: 768 };
    assert.equal(isMobileViewport(), true);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('mobile mission inspection CSS promotes landing preview first and disables canvas touch hijack', async () => {
  const css = await readFile(
    new URL('../src/styles/mission-hub.css', import.meta.url),
    'utf8'
  );
  const mobileBlockStart = css.indexOf('@media (max-width: 900px)');
  assert.ok(mobileBlockStart !== -1, 'expected 900px mobile media query');
  const mobileBlock = css.slice(mobileBlockStart);

  assert.match(mobileBlock, /\.planet-analysis__header\s*\{\s*order:\s*0;/);
  assert.match(mobileBlock, /\.planet-analysis__preview\s*\{\s*order:\s*1;/);
  assert.match(mobileBlock, /\.planet-analysis__intro\s*\{\s*order:\s*2;/);
  assert.match(mobileBlock, /\.planet-surface__canvas\s*\{[^}]*touch-action:\s*pan-y;/);
  assert.match(mobileBlock, /\.planet-surface__canvas canvas\s*\{[^}]*pointer-events:\s*none;/);
});
