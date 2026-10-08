import { describe, expect, it } from 'vitest';

import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { folderBridge } from './folderBridge';

/**
 * 30 — Library folders, Phase 5: "the native picker" (issue #272).
 *
 * `updateBridge`'s twin: the one reader of `window.familyflix?.folders`. A
 * browser has no `familyflix` global, and that is a state, not an error: the
 * reader answers `null` and the page draws no _Browse…_.
 */

describe('folderBridge — in a browser', () => {
  it('is null with no familyflix global', () => {
    expect(window.familyflix).toBeUndefined();
    expect(folderBridge()).toBeNull();
  });
});

describe('folderBridge — under the Desktop shell', () => {
  const bridge = fakeFolderBridge();

  it('returns the folders member the preload defined', () => {
    expect(folderBridge()).toBe(bridge.folders);
  });
});
