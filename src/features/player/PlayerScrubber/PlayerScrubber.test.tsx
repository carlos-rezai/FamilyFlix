import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PlayerScrubber } from './PlayerScrubber';
import { theme } from '@/styles/theme';

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * The **Scrubber**: track, accent fill, knob, and a clock either side. It takes
 * its duration from the **Playback read** — handed down as a prop, because the
 * component is presentational — never from `video.duration` and never from the
 * record's rounded, nullable `runtimeMinutes`.
 *
 * The one behaviour worth stating twice: a drag moves the knob and the elapsed
 * clock continuously and **does not seek the picture** until the knob is let
 * go. Seeking on every pointer move is the version of this that fights the
 * hand holding it, and on a stream path it is the version that restarts ffmpeg
 * forty times in a second.
 *
 * jsdom lays nothing out, so the track's rect is stubbed; every scalar in here
 * would otherwise be a division by zero.
 */
const DURATION = 6832.5;
const TRACK_LEFT = 100;
const TRACK_WIDTH = 200;

/** Where the two clocks sit, read out of the prototype: `1:53:52` and `0:00`. */
const TOTAL_CLOCK = '1:53:52';

function renderScrubber(
  overrides: Partial<Parameters<typeof PlayerScrubber>[0]> = {}
) {
  const onSeek = vi.fn<(seconds: number) => void>();
  const view = render(
    <ThemeProvider theme={theme}>
      <PlayerScrubber
        position={0}
        duration={DURATION}
        onSeek={onSeek}
        {...overrides}
      />
    </ThemeProvider>
  );

  const track = screen.getByRole('slider', { name: 'Seek' });
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

  /** Press on the track at a fraction along it, the way a parent starts a drag. */
  const pressAt = (fraction: number) =>
    fireEvent.pointerDown(track, {
      clientX: TRACK_LEFT + TRACK_WIDTH * fraction,
    });

  const moveTo = (clientX: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX }));
    });

  const releaseAt = (clientX: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX }));
    });

  const dragTo = (fraction: number) =>
    moveTo(TRACK_LEFT + TRACK_WIDTH * fraction);

  return { ...view, track, onSeek, pressAt, moveTo, dragTo, releaseAt };
}

describe('PlayerScrubber', () => {
  it('shows how far in the film is and how long it runs, either side of the track', () => {
    renderScrubber({ position: 2450 });

    expect(screen.getByText('40:50')).toBeDefined();
    expect(screen.getByText(TOTAL_CLOCK)).toBeDefined();
  });

  it('formats both clocks the way the rest of the app does', () => {
    // `formatClock`, not a second implementation: a scrubber that says `40:50`
    // beside a movie page that says `40:50` is one app.
    renderScrubber({ position: 59.9 });

    expect(screen.getByText('0:59')).toBeDefined();
  });

  it('fills the track and places the knob at how far in the film is', () => {
    const { container } = renderScrubber({ position: DURATION / 4 });

    expect(percentages(container)).toContain('25%');
  });

  it('jumps to the point on the track that was clicked', () => {
    // A click is the drag with no movement in it, so a parent who taps the bar
    // gets there without knowing there is a knob at all.
    const { onSeek, pressAt, releaseAt } = renderScrubber();

    pressAt(0.5);
    releaseAt(TRACK_LEFT + TRACK_WIDTH * 0.5);

    expect(onSeek).toHaveBeenCalledExactlyOnceWith(DURATION / 2);
  });

  it('seeks to the very start and to the very end of the track', () => {
    const { onSeek, pressAt, releaseAt } = renderScrubber();

    pressAt(0);
    releaseAt(TRACK_LEFT);
    expect(onSeek).toHaveBeenLastCalledWith(0);

    pressAt(1);
    releaseAt(TRACK_LEFT + TRACK_WIDTH);
    expect(onSeek).toHaveBeenLastCalledWith(DURATION);
  });

  it('moves the knob and the elapsed clock while the knob is being dragged', () => {
    const { container, pressAt, dragTo } = renderScrubber({ position: 0 });

    pressAt(0.1);
    dragTo(0.75);

    expect(percentages(container)).toContain('75%');
    expect(screen.getByText('1:25:24')).toBeDefined();
  });

  it('leaves the picture alone until the knob is let go', () => {
    // The acceptance criterion, stated as an absence: seeking on every move is
    // what makes scrubbing feel like a fight.
    const { onSeek, pressAt, dragTo } = renderScrubber();

    pressAt(0.1);
    dragTo(0.4);
    dragTo(0.6);
    dragTo(0.75);

    expect(onSeek).not.toHaveBeenCalled();
  });

  it('seeks once, on release, to where the knob was let go', () => {
    const { onSeek, pressAt, dragTo, releaseAt } = renderScrubber();

    pressAt(0.1);
    dragTo(0.4);
    dragTo(0.75);
    releaseAt(TRACK_LEFT + TRACK_WIDTH * 0.75);

    expect(onSeek).toHaveBeenCalledExactlyOnceWith(DURATION * 0.75);
  });

  it('keeps following a pointer that has wandered off the track and back', () => {
    // Nobody drags a 6px bar in a straight line. A drag that stopped tracking
    // the moment the pointer strayed above it would be unusable.
    const { container, pressAt, moveTo, dragTo } = renderScrubber({
      position: DURATION / 2,
    });

    pressAt(0.5);
    moveTo(TRACK_LEFT - 400);
    expect(percentages(container)).toContain('0%');

    dragTo(0.6);

    expect(percentages(container)).toContain('60%');
  });

  it('commits a drag released clean off the end of the track', () => {
    const { onSeek, pressAt, releaseAt } = renderScrubber();

    pressAt(0.5);
    releaseAt(TRACK_LEFT + TRACK_WIDTH + 500);

    expect(onSeek).toHaveBeenCalledExactlyOnceWith(DURATION);
  });

  it('goes on following the pointer while the film plays underneath it', () => {
    // The position prop keeps arriving during a drag — ten times a second —
    // and the knob must stay under the finger rather than being yanked back to
    // wherever the film has got to.
    const { container, pressAt, dragTo, rerender } = renderScrubber();

    pressAt(0.5);
    dragTo(0.8);
    rerender(
      <ThemeProvider theme={theme}>
        <PlayerScrubber
          position={DURATION * 0.1}
          duration={DURATION}
          onSeek={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(percentages(container)).toContain('80%');
  });

  it('draws a real, seekable scrubber for a film the catalogue has no runtime for', () => {
    // User story 64. The duration never came from `runtimeMinutes`, so a blank
    // metadata field costs the family nothing at all.
    const { container, onSeek, pressAt, releaseAt } = renderScrubber({
      duration: 5400,
      position: 1350,
    });

    expect(screen.getByText('1:30:00')).toBeDefined();
    expect(percentages(container)).toContain('25%');

    pressAt(0.5);
    releaseAt(TRACK_LEFT + TRACK_WIDTH * 0.5);
    expect(onSeek).toHaveBeenCalledExactlyOnceWith(2700);
  });
});

/**
 * Every width and offset the scrubber draws itself with, as percentages. The
 * fill and the knob are two elements sharing one number, and which of them is
 * which is the styling's business rather than this file's.
 */
function percentages(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).flatMap(
    (element) => {
      const style = window.getComputedStyle(element);
      return [style.width, style.left].filter((value) => value.endsWith('%'));
    }
  );
}
