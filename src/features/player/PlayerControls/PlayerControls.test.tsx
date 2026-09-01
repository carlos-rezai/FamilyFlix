import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

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

function renderControls(
  overrides: Partial<Parameters<typeof PlayerControls>[0]> = {}
) {
  const onBack = vi.fn();
  const onTogglePlay = vi.fn();
  const view = render(
    <ThemeProvider theme={theme}>
      <PlayerControls
        title={FILM}
        visible
        playing
        onBack={onBack}
        onTogglePlay={onTogglePlay}
        {...overrides}
      />
    </ThemeProvider>
  );

  return { ...view, onBack, onTogglePlay };
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

  it('draws no clock yet — the scrubber and its times are the next slice', () => {
    // A guard against building the next slice's surface early: this one ships
    // the transport minus the two sliders, and half a scrubber is worse than
    // none.
    const { container } = renderControls();

    expect(container.textContent).not.toMatch(/\d+:\d{2}/);
  });
});
