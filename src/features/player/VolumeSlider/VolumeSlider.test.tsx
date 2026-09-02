import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { VolumeSlider } from './VolumeSlider';
import { theme } from '@/styles/theme';

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * The volume control: the speaker button and the 90px bar the prototype groups
 * beside it. It shares `useDragScalar` with the **Scrubber** and not a single
 * styled component — the two differ in height, knob and colour, and a `Slider`
 * primitive with a prop per difference is the thing being avoided.
 *
 * Where it differs from the scrubber in behaviour, and deliberately: volume
 * follows the pointer as it moves. A parent turning a loud film down wants to
 * hear it get quieter while they are still holding the pointer, whereas seeking
 * on every move would fight the hand that is dragging the knob.
 *
 * Muted, near-silent and audible are three states the family can tell apart:
 * the glyph is crossed for the first two and open for the third, and the button
 * says "Unmute" only when the sound is actually muted — so a film turned all
 * the way down is not mistaken for one that was silenced.
 */
const TRACK_LEFT = 100;
const TRACK_WIDTH = 90;

/** Where the prototype draws the line: below this the glyph reads silenced. */
const NEAR_SILENT = 0.02;

function renderVolume(
  overrides: Partial<Parameters<typeof VolumeSlider>[0]> = {}
) {
  const onVolumeChange = vi.fn<(value: number) => void>();
  const onToggleMute = vi.fn<() => void>();
  const view = render(
    <ThemeProvider theme={theme}>
      <VolumeSlider
        volume={0.8}
        muted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
        {...overrides}
      />
    </ThemeProvider>
  );

  const track = screen.getByRole('slider', { name: 'Volume' });
  track.getBoundingClientRect = () =>
    ({
      x: TRACK_LEFT,
      y: 0,
      left: TRACK_LEFT,
      right: TRACK_LEFT + TRACK_WIDTH,
      top: 0,
      bottom: 5,
      width: TRACK_WIDTH,
      height: 5,
      toJSON: () => ({}),
    }) as DOMRect;

  const pressAt = (fraction: number) =>
    fireEvent.pointerDown(track, {
      clientX: TRACK_LEFT + TRACK_WIDTH * fraction,
    });

  const dragTo = (fraction: number) =>
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: TRACK_LEFT + TRACK_WIDTH * fraction,
        })
      );
    });

  const releaseAt = (fraction: number) =>
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointerup', {
          clientX: TRACK_LEFT + TRACK_WIDTH * fraction,
        })
      );
    });

  return {
    ...view,
    track,
    onVolumeChange,
    onToggleMute,
    pressAt,
    dragTo,
    releaseAt,
  };
}

describe('VolumeSlider', () => {
  it('changes the volume to the point on the bar that was clicked', () => {
    const { onVolumeChange, pressAt, releaseAt } = renderVolume();

    pressAt(0.5);
    releaseAt(0.5);

    expect(onVolumeChange).toHaveBeenLastCalledWith(0.5);
  });

  it('reaches silence at one end and full volume at the other', () => {
    // "Across its full range" means both ends are actually reachable: a bar
    // that bottoms out at 0.04 is a bar that cannot turn a film off.
    const { onVolumeChange, pressAt, releaseAt } = renderVolume();

    pressAt(0);
    releaseAt(0);
    expect(onVolumeChange).toHaveBeenLastCalledWith(0);

    pressAt(1);
    releaseAt(1);
    expect(onVolumeChange).toHaveBeenLastCalledWith(1);
  });

  it('follows the pointer as it is dragged, rather than waiting for release', () => {
    // The opposite of the scrubber, on purpose: you turn a film down by ear.
    const { onVolumeChange, pressAt, dragTo } = renderVolume();

    pressAt(0.9);
    dragTo(0.6);
    dragTo(0.3);

    expect(onVolumeChange.mock.calls.map(([value]) => value)).toEqual([
      0.9, 0.6, 0.3,
    ]);
  });

  it('fills the bar to the volume it is set to', () => {
    const { container } = renderVolume({ volume: 0.4 });

    expect(percentages(container)).toContain('40%');
  });

  it('draws an empty bar while muted, without having changed the level', () => {
    // The prototype's `volPct = muted ? 0 : volume * 100`. The level is intact
    // underneath, which is what unmute gives back.
    const { container, onVolumeChange } = renderVolume({
      volume: 0.8,
      muted: true,
    });

    expect(percentages(container)).toContain('0%');
    expect(percentages(container)).not.toContain('80%');
    expect(onVolumeChange).not.toHaveBeenCalled();
  });

  it('silences the film from the speaker button', () => {
    const { onToggleMute } = renderVolume();

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('offers to give the sound back once it is muted', () => {
    // The name is the third state: a muted film says "Unmute", a film merely
    // turned all the way down still says "Mute", and they are not the same
    // thing to undo.
    const { onToggleMute } = renderVolume({ muted: true });

    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('crosses the speaker out while the film is muted', () => {
    const { container } = renderVolume({ volume: 0.8, muted: true });

    expect(silenced(container)).toBe(true);
  });

  it('crosses the speaker out while the volume is near silent', () => {
    // User story 21: a family member who cannot hear anything can see why,
    // whether it was the mute button or a bar dragged to the floor.
    const { container } = renderVolume({ volume: NEAR_SILENT, muted: false });

    expect(silenced(container)).toBe(true);
    expect(screen.getByRole('button', { name: 'Mute' })).toBeDefined();
  });

  it('leaves the speaker open while the film is audible', () => {
    const { container } = renderVolume({ volume: 0.8, muted: false });

    expect(silenced(container)).toBe(false);
  });
});

/**
 * Whether the speaker is drawn crossed out. The two paths are the prototype's
 * own, to the character: the cross that means silenced, and the arc that means
 * sound is coming out. Asserting on them is what "matches
 * `feat.PlayerControls.dc.html`" means in a test.
 */
const CROSS = 'M17 9l4 6M21 9l-4 6';
const ARC = 'M16.5 8.5a5 5 0 010 7';

function silenced(container: HTMLElement): boolean {
  const crossed = container.querySelector(`path[d="${CROSS}"]`) !== null;
  const open = container.querySelector(`path[d="${ARC}"]`) !== null;

  // Exactly one of the two, always — a speaker drawn with both marks or with
  // neither is not a state the family can read.
  expect([crossed, open]).toContainEqual(true);
  expect(crossed && open).toBe(false);

  return crossed;
}

/** Every width the control draws itself with, as percentages. */
function percentages(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('*'))
    .map((element) => window.getComputedStyle(element).width)
    .filter((value) => value.endsWith('%'));
}
