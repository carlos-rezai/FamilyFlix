import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { AudioMenu } from './AudioMenu';
import { theme } from '@/styles/theme';
import type { AudioTrack } from '@/types';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 46 — Audio tracks, Phase 5: "the picker" (issue #403).
 *
 * The **Audio picker**, `feat.PlayerControls.dc.html`'s Audio button and the
 * menu it opens: a round 44px chrome button named _Audio_, carrying the
 * `SpeechBubbleIcon`, over a `Menu` that opens **upward** — over the bottom
 * bar, not under it, where there is no screen left — with one item per offered
 * **Audio track**, named by its label, the playing one marked as
 * `FilterDropdown` marks its value.
 *
 * It is presentational: handed the tracks, the one playing and what to call. It
 * says when it opens and shuts, because an open menu holds the **Chrome** up and
 * the chrome is not this component's to hold.
 */

function track(overrides: Partial<AudioTrack>): AudioTrack {
  return {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: false,
    path: 'direct',
    ...overrides,
  };
}

const ENGLISH = track({ index: 0, fileDefault: true });
const SPANISH = track({
  index: 1,
  language: 'Spanish',
  label: 'Spanish',
  path: 'remux',
});
const COMMENTARY = track({
  index: 2,
  language: 'English',
  label: 'English · Commentary',
  path: 'transcode',
});

const THREE = [ENGLISH, SPANISH, COMMENTARY];

function renderMenu(overrides: Partial<Parameters<typeof AudioMenu>[0]> = {}) {
  const onChoose = vi.fn<(choice: AudioTrack) => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const view = render(
    <ThemeProvider theme={theme}>
      <div>
        <AudioMenu
          tracks={THREE}
          playing={SPANISH}
          onChoose={onChoose}
          onOpenChange={onOpenChange}
          {...overrides}
        />
        <span>Elsewhere</span>
      </div>
    </ThemeProvider>
  );
  return { ...view, onChoose, onOpenChange };
}

function audioButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Audio' });
}

function open(): HTMLElement {
  fireEvent.click(audioButton());
  return screen.getByRole('menu');
}

describe('AudioMenu — the button', () => {
  it('is a button named Audio for a screen reader, and titled Audio on hover', () => {
    renderMenu();

    expect(audioButton().getAttribute('title')).toBe('Audio');
  });

  it('carries the speech bubble', () => {
    renderMenu();

    const paths = Array.from(audioButton().querySelectorAll('svg path')).map(
      (path) => path.getAttribute('d')
    );
    expect(paths).toContain('M8 10h8M8 13h5');
  });

  it('is the 44px round chrome button the prototype draws', () => {
    renderMenu();

    const style = window.getComputedStyle(audioButton());
    expect(style.width).toBe('44px');
    expect(style.height).toBe('44px');
  });

  it('starts shut, and says it opens a menu', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(audioButton().getAttribute('aria-haspopup')).toBe('menu');
    expect(audioButton().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('AudioMenu — the menu', () => {
  it('opens on a press with one item per offered track, named by its label', () => {
    renderMenu();

    const menu = open();

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['English', 'Spanish', 'English · Commentary']);
    expect(audioButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('marks the playing track, and only that one', () => {
    renderMenu({ playing: SPANISH });

    const menu = open();

    const marked = within(menu)
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-current') === 'true')
      .map((item) => item.textContent);
    expect(marked).toEqual(['Spanish']);
  });

  it('opens upward, over the bottom bar, rather than hanging below the button', () => {
    renderMenu();

    const style = resolvedStyle(open());

    expect(style.bottom).toBe('54px');
    expect(style.top ?? 'auto').toBe('auto');
  });

  it('chooses the track pressed, and shuts', () => {
    const { onChoose } = renderMenu();
    const menu = open();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'English' }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(ENGLISH);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('AudioMenu — saying when it is open', () => {
  it('reports itself open on a press', () => {
    const { onOpenChange } = renderMenu();

    open();

    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it('shuts on Escape, and reports it', () => {
    const { onOpenChange } = renderMenu();
    open();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('shuts on a press outside it, and reports it', () => {
    const { onOpenChange } = renderMenu();
    open();

    fireEvent.pointerDown(screen.getByText('Elsewhere'));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('reports itself shut once a track is chosen', () => {
    const { onOpenChange } = renderMenu();
    const menu = open();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'English' }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe('AudioMenu — from the keyboard', () => {
  it('opens on Enter, lands on the playing track, walks with the arrows and chooses with Enter', async () => {
    const user = userEvent.setup();
    const { onChoose } = renderMenu({ playing: SPANISH });

    audioButton().focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menu')).toBeDefined();
    expect(document.activeElement?.textContent).toBe('Spanish');

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('English · Commentary');

    await user.keyboard('{Enter}');

    expect(onChoose).toHaveBeenCalledWith(COMMENTARY);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(audioButton());
  });
});
