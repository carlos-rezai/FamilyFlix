// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { idleLayoutFill } from './idleLayoutFill';

describe('idleLayoutFill', () => {
  it('writes nothing and logs nothing for any title', async () => {
    await expect(idleLayoutFill().fill('any-title')).resolves.toEqual({
      written: [],
      lines: [],
    });
  });
});
