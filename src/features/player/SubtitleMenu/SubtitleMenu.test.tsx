import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SubtitleMenu } from './SubtitleMenu';
import { theme } from '@/styles/theme';
import type { Subtitle } from '@/types';

/**
 * 50, Subtitle picker, Phase 3 (issue #437).
 *
 * The **Subtitle picker**, `feat.PlayerControls.dc.html`'s CC pill as a menu
 * trigger: the same face (icon, _CC_, lit while subtitles show), named
 * _Subtitles_, over the Audio picker's upward panel. Items: _Off_, then one per
 * **Subtitle** in track order, each named by its **Subtitle label**, the showing
 * one marked, or _Off_ while off.
 *
 * A menu button, never a toggle: it says it opens a menu and carries no
 * `aria-pressed`. Presentational, like `AudioMenu`: handed the rows, the
 * showing track and what to call, and it says when it opens and shuts because
 * an open menu holds the **Chrome** up.
 */
function row(id: string, language: string, position: number): Subtitle {
  return { id, path: `Northwind (2018)/${id}.srt`, language, position };
}

const ENGLISH = row('s1', 'English', 0);
const SPANISH = row('s2', 'Spanish', 1);
const ENGLISH_SDH = row('s3', 'English', 2);

const ROWS = [ENGLISH, SPANISH, ENGLISH_SDH];

function renderMenu(
  overrides: Partial<Parameters<typeof SubtitleMenu>[0]> = {}
) {
  const onChoose = vi.fn<(choice: Subtitle | null) => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const view = render(
    <ThemeProvider theme={theme}>
      <div>
        <SubtitleMenu
          subtitles={ROWS}
          track={SPANISH}
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

function pill(): HTMLElement {
  return screen.getByRole('button', { name: 'Subtitles' });
}

function open(): HTMLElement {
  fireEvent.click(pill());
  return screen.getByRole('menu');
}

function items(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent ?? '');
}

function marked(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole('menuitem')
    .filter((item) => item.getAttribute('aria-current') === 'true')
    .map((item) => item.textContent ?? '');
}

describe('SubtitleMenu: the trigger', () => {
  it('is the CC pill, named Subtitles', () => {
    renderMenu();

    expect(pill().textContent).toContain('CC');
    expect(pill().querySelector('svg')).not.toBeNull();
  });

  it('says it opens a menu, and is no toggle', () => {
    renderMenu();

    expect(pill().getAttribute('aria-haspopup')).toBe('menu');
    expect(pill().getAttribute('aria-expanded')).toBe('false');
    expect(pill().hasAttribute('aria-pressed')).toBe(false);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('wears the lit face while subtitles show, and the dim one while off', () => {
    const { unmount } = renderMenu({ track: SPANISH });
    const on = window.getComputedStyle(pill());
    expect(on.backgroundColor).toBe('rgba(255, 255, 255, 0.16)');
    expect(on.color).toBe('rgb(255, 255, 255)');
    unmount();

    renderMenu({ track: null });
    const off = window.getComputedStyle(pill());
    expect(off.backgroundColor).not.toBe('rgba(255, 255, 255, 0.16)');
    expect(off.color).not.toBe('rgb(255, 255, 255)');
  });
});

describe('SubtitleMenu: the menu', () => {
  it('lists Off, then each Subtitle by its label in track order', () => {
    renderMenu();

    const menu = open();

    expect(items(menu)).toEqual([
      'Off',
      'English · Track 1',
      'Spanish',
      'English · Track 3',
    ]);
    expect(pill().getAttribute('aria-expanded')).toBe('true');
  });

  it('marks the showing track, and only that one', () => {
    renderMenu({ track: ENGLISH_SDH });

    expect(marked(open())).toEqual(['English · Track 3']);
  });

  it('marks Off while subtitles are off', () => {
    renderMenu({ track: null });

    expect(marked(open())).toEqual(['Off']);
  });
});

describe('SubtitleMenu: a pick', () => {
  it('chooses the row pressed, and shuts', () => {
    const { onChoose } = renderMenu();
    const menu = open();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Spanish' }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(SPANISH);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('chooses null for Off, and shuts', () => {
    const { onChoose } = renderMenu();
    const menu = open();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Off' }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('SubtitleMenu: saying when it is open', () => {
  it('reports itself open on a press', () => {
    const { onOpenChange } = renderMenu();

    open();

    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it('reports itself shut once a row is chosen', () => {
    const { onOpenChange } = renderMenu();
    const menu = open();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Off' }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('shuts on Escape with no choice, and reports it', () => {
    const { onChoose, onOpenChange } = renderMenu();
    open();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onChoose).not.toHaveBeenCalled();
  });
});
