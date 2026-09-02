import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { readFileSync } from 'node:fs';

import { PlayerControls } from './PlayerControls';
import { theme } from '@/styles/theme';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * The **Chrome**: the player's two overlaid bars — Back pill and serif title
 * above, the transport row below — which fade in and out together as one thing.
 * A 1:1 translation of `feat.PlayerControls.dc.html`, minus the **Scrubber**
 * and the volume slider, which are the next slice's.
 *
 * It is presentational: it is handed what is true and what to call, and decides
 * nothing. Whether the chrome may fade at all is `useControlsVisibility`'s
 * question, and whether the film is playing is `usePlayback`'s.
 */
const FILM = 'Northwind';

/** The film's length, as the **Playback read** reports it: `1:53:52`. */
const DURATION = 6832.5;

function renderControls(
  overrides: Partial<Parameters<typeof PlayerControls>[0]> = {}
) {
  const onBack = vi.fn();
  const onTogglePlay = vi.fn();
  const onSeek = vi.fn<(seconds: number) => void>();
  const onSkip = vi.fn<(deltaSeconds: number) => void>();
  const onVolumeChange = vi.fn<(value: number) => void>();
  const onToggleMute = vi.fn();
  const view = render(
    <ThemeProvider theme={theme}>
      <PlayerControls
        title={FILM}
        visible
        playing
        position={0}
        duration={DURATION}
        volume={0.8}
        muted={false}
        onBack={onBack}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onSkip={onSkip}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
        {...overrides}
      />
    </ThemeProvider>
  );

  return {
    ...view,
    onBack,
    onTogglePlay,
    onSeek,
    onSkip,
    onVolumeChange,
    onToggleMute,
  };
}

describe('PlayerControls', () => {
  it('names the film on screen, so a parent knows they opened the right one', () => {
    renderControls();

    expect(screen.getByText(FILM)).toBeDefined();
  });

  it('offers the way back to the film’s page', () => {
    const { onBack } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('offers a pause control while the film is running', () => {
    const { onTogglePlay } = renderControls({ playing: true });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('offers a play control while the film is stopped', () => {
    // One control, two faces — the same handler, so the button and the picture
    // can never disagree about what pressing it does.
    const { onTogglePlay } = renderControls({ playing: false });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('takes its controls out of reach once the chrome has faded', () => {
    // Faded chrome must not be operable or announced: an invisible Back pill
    // that a keyboard can still land on is a control nobody can see.
    renderControls({ visible: false });

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('fades rather than disappears, so it has something to fade back from', () => {
    const { container } = renderControls({ visible: false });

    expect(container.textContent).toContain(FILM);
  });
});

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * The transport row fills out: the **Scrubber** and its two clocks above it,
 * the ±10s buttons and the volume control beside play/pause. The chrome still
 * decides nothing — it is handed the position, the duration, the volume and
 * the mute state, and calls back.
 *
 * What is left inert after this slice is the CC pill (subtitles) and
 * fullscreen (the keyboard map), each drawn in the slice that can make it do
 * something.
 */
describe('PlayerControls — the transport row', () => {
  it('shows how far in the film is and how long it runs', () => {
    // The clock the previous slice deliberately did not draw. Both come from
    // the **Playback read** by way of the screen above, so a film the
    // catalogue has no runtime for still gets both.
    renderControls({ position: 2450, duration: 6832.5 });

    expect(screen.getByText('40:50')).toBeDefined();
    expect(screen.getByText('1:53:52')).toBeDefined();
  });

  it('replays the last ten seconds', () => {
    const { onSkip } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Back 10s' }));

    expect(onSkip).toHaveBeenCalledExactlyOnceWith(-10);
  });

  it('skips the next ten seconds', () => {
    // One handler with a signed delta rather than two, because the keyboard
    // map arrives next and has to move the film the same way the buttons do
    // rather than by a second code path.
    const { onSkip } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Forward 10s' }));

    expect(onSkip).toHaveBeenCalledExactlyOnceWith(10);
  });

  it('carries the volume control beside the transport', () => {
    const { onToggleMute } = renderControls({ volume: 0.8, muted: false });

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('takes both sliders out of reach once the chrome has faded', () => {
    // Same rule as the Back pill: a scrubber a keyboard can still land on
    // while nothing is on screen is a control nobody can see. Asserted from
    // both sides, because an absence on its own is also what a slider that was
    // never drawn at all looks like.
    const { rerender } = renderControls();
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeDefined();

    rerender(
      <ThemeProvider theme={theme}>
        <PlayerControls
          title={FILM}
          visible={false}
          playing
          position={0}
          duration={DURATION}
          volume={0.8}
          muted={false}
          onBack={vi.fn()}
          onTogglePlay={vi.fn()}
          onSeek={vi.fn()}
          onSkip={vi.fn()}
          onVolumeChange={vi.fn()}
          onToggleMute={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.queryByRole('slider', { name: 'Seek' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Volume' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back 10s' })).toBeNull();
  });

  it('draws no CC pill and no working fullscreen yet — later slices', () => {
    // A guard against building the next slices' surface early. A control that
    // does nothing when a parent presses it is worse than one that is not
    // there yet.
    renderControls();

    expect(screen.queryByRole('button', { name: /CC|subtitle/i })).toBeNull();
  });
});

/**
 * The acceptance criterion that is about the shape of the code rather than
 * what is on screen, checked the only way it can be: at the source. The two
 * sliders share the drag arithmetic and nothing else — no styled component
 * between them, and neither reaching into the other. Both would still pass
 * every behavioural test above on the day one of them became a prop on the
 * other, which is exactly why this one exists.
 *
 * The precedent is the duration rule in `usePlayback.test.ts`: a structural
 * promise, kept by reading the files.
 */
describe('the two sliders', () => {
  const scrubber = 'src/features/player/PlayerScrubber';
  const volume = 'src/features/player/VolumeSlider';

  it('both sit on the shared drag hook', () => {
    expect(sourceOf(`${scrubber}/PlayerScrubber.tsx`)).toContain(
      'useDragScalar'
    );
    expect(sourceOf(`${volume}/VolumeSlider.tsx`)).toContain('useDragScalar');
  });

  it('share no styled component, and neither imports the other', () => {
    const scrubberSource = [
      sourceOf(`${scrubber}/PlayerScrubber.tsx`),
      sourceOf(`${scrubber}/PlayerScrubber.styles.ts`),
    ].join('\n');
    const volumeSource = [
      sourceOf(`${volume}/VolumeSlider.tsx`),
      sourceOf(`${volume}/VolumeSlider.styles.ts`),
    ].join('\n');

    expect(scrubberSource).not.toMatch(/VolumeSlider/);
    expect(volumeSource).not.toMatch(/PlayerScrubber/);
  });
});

/** One of the feature's files, read off disk — the seam a structural rule has. */
function sourceOf(path: string): string {
  return readFileSync(path, 'utf8');
}
