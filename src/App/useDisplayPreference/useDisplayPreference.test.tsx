import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

import { useDisplayPreference } from './useDisplayPreference';

/**
 * 27 — Ultrawide margins, Phase 1 (issue #249).
 *
 * The provider is mounted in `App`, so a consumer outside one is a wiring
 * mistake, and a silent `null` would hide it: `useDisplayPreference()` throws,
 * naming itself — `useSnackbar`'s precedent. Under the provider its behaviour
 * is the provider's suite.
 */

function Consumer() {
  useDisplayPreference();
  return null;
}

describe('useDisplayPreference — outside a provider', () => {
  it('throws, and the message names the hook', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => render(<Consumer />)).toThrow(/useDisplayPreference/);

    consoleError.mockRestore();
  });
});
