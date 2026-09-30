// @vitest-environment node
//
// Issue #226 — a crashed renderer is reloaded once, by a unit. `reloadOnce`
// answers main's `render-process-gone` listener over an injected `reload` and
// `isGone()`: the first crash reloads, a second does not, and a window that is
// already gone is left alone. Electron is never launched.

import { describe, expect, it, vi } from 'vitest';

import { reloadOnce } from './reloadOnce';

function world(gone = false) {
  return { reload: vi.fn(), isGone: () => gone };
}

describe('reloadOnce', () => {
  it('reloads on the first crash', () => {
    const w = world();
    const onGone = reloadOnce(w);

    onGone();

    expect(w.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves a second crash as it is', () => {
    const w = world();
    const onGone = reloadOnce(w);

    onGone();
    onGone();

    expect(w.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves a window that is gone alone', () => {
    const w = world(true);
    const onGone = reloadOnce(w);

    onGone();

    expect(w.reload).not.toHaveBeenCalled();
  });

  it('does not spend the one reload on a window that was gone', () => {
    const reload = vi.fn();
    const onGone = reloadOnce({
      reload,
      isGone: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
    });

    onGone();
    onGone();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
