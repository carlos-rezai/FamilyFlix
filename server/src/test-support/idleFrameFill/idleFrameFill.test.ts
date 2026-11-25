// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { idleFrameFill } from './idleFrameFill';

describe('idleFrameFill', () => {
  it('resolves at once for any series', async () => {
    await expect(idleFrameFill().fill('any-series')).resolves.toBeUndefined();
  });
});
