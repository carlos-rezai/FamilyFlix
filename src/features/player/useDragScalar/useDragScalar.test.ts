import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useDragScalar } from './useDragScalar';

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * The half the **Scrubber** and the volume slider share. Not a `Slider`
 * primitive: the two differ in height, knob and colour, and forcing them
 * together means a primitive with a prop per difference. What they genuinely
 * have in common is the arithmetic — a pointer over a track, a 0–1 scalar out —
 * and that is all this is.
 *
 * Everything here is asserted through the scalars the hook reports and commits,
 * never through the listeners it registers: a drag that survives a pointer
 * leaving the track is the behaviour, and `window` versus pointer capture is
 * the implementation. jsdom has no `setPointerCapture`, which is a hint rather
 * than the reason.
 *
 * The track is 200px wide from x=100, so a client x of 150 is a quarter along
 * and the two ends are unambiguous — jsdom lays nothing out, so the rect is
 * stubbed or every scalar is a division by zero.
 */
const TRACK_LEFT = 100;
const TRACK_WIDTH = 200;

/** Where along the track a given client x lands, for reading the tests. */
const QUARTER = TRACK_LEFT + TRACK_WIDTH * 0.25;
const HALF = TRACK_LEFT + TRACK_WIDTH * 0.5;
const THREE_QUARTERS = TRACK_LEFT + TRACK_WIDTH * 0.75;

/** A track element laid out the way jsdom refuses to lay anything out. */
function trackElement(): HTMLDivElement {
  const track = document.createElement('div');
  track.getBoundingClientRect = () =>
    ({
      x: TRACK_LEFT,
      y: 0,
      left: TRACK_LEFT,
      right: TRACK_LEFT + TRACK_WIDTH,
      top: 0,
      bottom: 6,
      width: TRACK_WIDTH,
      height: 6,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.append(track);
  return track;
}

function renderDragScalar() {
  const onDrag = vi.fn<(value: number) => void>();
  const onCommit = vi.fn<(value: number) => void>();
  const track = trackElement();

  const view = renderHook(() => useDragScalar({ onDrag, onCommit }));
  act(() => {
    view.result.current.trackRef.current = track;
  });

  /** Press the pointer down on the track, the way a parent starts either drag. */
  const pressAt = (clientX: number) =>
    act(() => {
      view.result.current.onPointerDown({
        clientX,
        preventDefault: () => undefined,
      } as React.PointerEvent<HTMLElement>);
    });

  /** Move the pointer — anywhere at all, including off the track entirely. */
  const moveTo = (clientX: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX }));
    });

  /** Let go, wherever the pointer happens to be. */
  const releaseAt = (clientX: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX }));
    });

  return { ...view, onDrag, onCommit, pressAt, moveTo, releaseAt };
}

describe('useDragScalar', () => {
  it('reports nothing until a drag has started', () => {
    // `null` is what lets a slider draw the real value rather than a stale
    // drag: there is no scalar under the pointer when nobody is pressing.
    const { result } = renderDragScalar();

    expect(result.current.value).toBeNull();
  });

  it('yields the scalar the pointer came down on, and commits it on release', () => {
    // A click is a drag with no movement in it. Modelling it as one is what
    // gets "click anywhere on the track to jump there" for nothing.
    const { onCommit, pressAt, releaseAt, result } = renderDragScalar();

    pressAt(QUARTER);
    expect(result.current.value).toBeCloseTo(0.25);

    releaseAt(QUARTER);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(0.25);
  });

  it('follows the pointer continuously without committing anything', () => {
    // The whole point of the split: the surface can follow a finger while the
    // thing behind it — the picture — is left alone until the knob is let go.
    const { onDrag, onCommit, pressAt, moveTo, result } = renderDragScalar();

    pressAt(QUARTER);
    moveTo(HALF);
    expect(result.current.value).toBeCloseTo(0.5);

    moveTo(THREE_QUARTERS);
    expect(result.current.value).toBeCloseTo(0.75);

    expect(onDrag.mock.calls.map(([value]) => value)).toEqual([
      0.25, 0.5, 0.75,
    ]);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps tracking a pointer that has left the track, and clamps at both ends', () => {
    // Dragging a knob to the very end means overshooting it, every time. A
    // scalar outside 0–1 would seek past the end of the film.
    const { pressAt, moveTo, result } = renderDragScalar();

    pressAt(HALF);

    moveTo(TRACK_LEFT + TRACK_WIDTH + 400);
    expect(result.current.value).toBe(1);

    moveTo(TRACK_LEFT - 400);
    expect(result.current.value).toBe(0);
  });

  it('comes back to the pointer when it returns to the track', () => {
    const { pressAt, moveTo, result } = renderDragScalar();

    pressAt(HALF);
    moveTo(TRACK_LEFT - 400);
    moveTo(THREE_QUARTERS);

    expect(result.current.value).toBeCloseTo(0.75);
  });

  it('commits a release that happened outside the track', () => {
    // The pointer is above or below the bar by the time it is let go far more
    // often than not, and a drag that silently did nothing is the worst of the
    // three possible answers.
    const { onCommit, pressAt, moveTo, releaseAt } = renderDragScalar();

    pressAt(QUARTER);
    moveTo(THREE_QUARTERS);
    releaseAt(TRACK_LEFT + TRACK_WIDTH + 400);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('ends the drag on release, so a stray pointer moves nothing', () => {
    const { onCommit, onDrag, pressAt, moveTo, releaseAt, result } =
      renderDragScalar();

    pressAt(QUARTER);
    releaseAt(QUARTER);
    onDrag.mockClear();

    moveTo(THREE_QUARTERS);

    expect(result.current.value).toBeNull();
    expect(onDrag).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('commits nothing once the slider has gone', () => {
    // The chrome unmounts its controls every time it fades, mid-drag included,
    // and a commit from a slider that is no longer on screen would seek a film
    // nobody is pointing at.
    const { onCommit, pressAt, releaseAt, unmount } = renderDragScalar();

    pressAt(HALF);
    unmount();
    releaseAt(HALF);

    expect(onCommit).not.toHaveBeenCalled();
  });
});
