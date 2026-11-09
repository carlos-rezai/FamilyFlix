// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { idleLibrarySheet } from './idleLibrarySheet';

describe('idleLibrarySheet', () => {
  it('answers every method and holds nothing', async () => {
    const sheet = idleLibrarySheet();

    expect(sheet.touch(['films'])).toBeUndefined();
    expect(sheet.hold('films')).toBeUndefined();
    expect(sheet.release('films')).toBeUndefined();
    await expect(sheet.flush()).resolves.toBeUndefined();
  });
});
