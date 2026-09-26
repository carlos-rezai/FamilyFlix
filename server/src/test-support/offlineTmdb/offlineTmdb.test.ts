// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { offlineTmdb } from './offlineTmdb';

describe('offlineTmdb', () => {
  it('answers unreachable to every key', async () => {
    expect(await offlineTmdb().authenticate('any-key')).toBe('unreachable');
  });
});
