import { describe, expect, it } from 'vitest';

import { fakeUpdateBridge } from '@/test-support/fakeUpdateBridge/fakeUpdateBridge';
import { updateBridge } from './updateBridge';

/**
 * 17 — Software update, Phase 1: "the bridge and the row" (issue #236).
 *
 * The one reader of `window.familyflix?.updates`. A browser has no
 * `familyflix` global — `npm run dev` is a browser — and that is a state, not
 * an error: the reader answers `null` and the row draws nothing.
 */

describe('updateBridge — in a browser', () => {
  it('is null with no familyflix global', () => {
    expect(window.familyflix).toBeUndefined();
    expect(updateBridge()).toBeNull();
  });
});

describe('updateBridge — under the Desktop shell', () => {
  const bridge = fakeUpdateBridge();

  it('returns the updates member the preload defined', () => {
    expect(updateBridge()).toBe(bridge.updates);
  });
});
