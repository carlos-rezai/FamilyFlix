import { describe, expect, it } from 'vitest';

import { zoneFace } from './zoneFace';

/**
 * 16 — Playback component upload, the refactor round (issue #157).
 *
 * The **Component drop zone**'s three faces as a table, on `importView`'s
 * precedent: an **Upload state** in, the copy and the one danger flag out.
 *
 * Copy is the zone's verbatim, because the zone's own leaves read it off the
 * screen: _Add a codec pack_ over the invitation the molecule composes, the
 * two busy sentences per write, and the route's reason kept under the
 * unchanged title when a write is refused.
 */

describe('zoneFace — the invitation', () => {
  it('invites a drop, with the line left to the molecule', () => {
    const face = zoneFace({ kind: 'idle' });

    expect(face.title).toBe('Add a codec pack');
    expect(face.line).toBeNull();
    expect(face.refused).toBe(false);
  });
});

describe('zoneFace — the two writes', () => {
  it('says the component is being added, and what that is doing', () => {
    const face = zoneFace({ kind: 'busy', action: 'install' });

    expect(face.title).toBe('Adding the playback component…');
    expect(face.line).toBe('Copying it in and checking it runs');
    expect(face.refused).toBe(false);
  });

  it('says the component is being removed, and what goes with it', () => {
    const face = zoneFace({ kind: 'busy', action: 'remove' });

    expect(face.title).toBe('Removing the playback component…');
    expect(face.line).toBe('The formats it added go with it');
    expect(face.refused).toBe(false);
  });
});

describe('zoneFace — a refusal', () => {
  it("keeps the invitation and carries the route's own reason under it", () => {
    const face = zoneFace({
      kind: 'refused',
      reason: 'Stop the film that is playing, then add it again.',
    });

    expect(face.title).toBe('Add a codec pack');
    expect(face.line).toBe('Stop the film that is playing, then add it again.');
  });

  it('is the one face drawn in the danger ink', () => {
    expect(zoneFace({ kind: 'refused', reason: 'Nope.' }).refused).toBe(true);
    expect(zoneFace({ kind: 'idle' }).refused).toBe(false);
    expect(zoneFace({ kind: 'busy', action: 'install' }).refused).toBe(false);
    expect(zoneFace({ kind: 'busy', action: 'remove' }).refused).toBe(false);
  });
});
