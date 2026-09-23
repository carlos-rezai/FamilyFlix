import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { EpisodeRow } from './EpisodeRow';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 22 — Series (TV), Phase 3 (issue #193): `mol.EpisodeRow` 1:1.
 *
 * One **Episode** on the **Season page**: a 168px 16:9 thumbnail in the
 * series' gradient with a resume bar along its foot while the episode is part
 * watched (and a play glyph on hover), then the `S02E04` code and the title —
 * _Untitled episode_ when there is none — over the air date and the **Resume
 * label**, then the watched box.
 *
 * The props are the prototype's: `episode { season, number, title, airDate,
 * watched, progress, resumeLabel, g1, g2 }` — `title`, `airDate` and
 * `resumeLabel` nullable, since the mapper has already decided what is
 * missing — plus `onOpen` and `onToggleWatched`.
 *
 * The row is a **Card** on `PosterCard`'s pattern: `role="button"`, one tab
 * stop named for its code and title, opened by a click, Enter or Space. The box
 * is a **Control** and a tab stop of its own, named by the prototype's tip
 * (_Mark as watched_ / _Watched — click to unmark_) and `aria-pressed` when the
 * episode is watched; it only marks — no click or key on it ever opens the row.
 */

type Episode = ComponentProps<typeof EpisodeRow>['episode'];

const G1 = '#1f2a3a';
const G2 = '#3a6a8a';

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    season: 2,
    number: 4,
    title: 'The Harvest',
    airDate: 'Mar 4, 2019',
    watched: false,
    progress: 0,
    resumeLabel: null,
    g1: G1,
    g2: G2,
    ...overrides,
  };
}

function renderRow(
  overrides: {
    episode?: Partial<Episode>;
    onOpen?: () => void;
    onToggleWatched?: () => void;
  } = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <EpisodeRow
        episode={makeEpisode(overrides.episode)}
        onOpen={overrides.onOpen ?? (() => undefined)}
        onToggleWatched={overrides.onToggleWatched ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

/** The row — one button, named for its code. */
function row(): HTMLElement {
  return screen.getByRole('button', { name: /^S02E04\b/ });
}

/** The watched box, by the tip it carries in either state. */
function box(): HTMLElement {
  return screen.getByRole('button', {
    name: /^(Mark as watched|Watched — click to unmark)$/,
  });
}

/** The 16:9 thumbnail — the row's first child. */
function thumbnail(): HTMLElement {
  const first = row().firstElementChild;
  if (first === null) throw new Error('the row has no thumbnail');
  return first as HTMLElement;
}

describe('EpisodeRow — what it reads', () => {
  it('reads the S02E04 code and the title', () => {
    renderRow();

    expect(within(row()).getByText('S02E04')).toBeDefined();
    expect(within(row()).getByText('The Harvest')).toBeDefined();
  });

  it('pads the code to two digits and leaves a two-digit number alone', () => {
    renderRow({ episode: { season: 1, number: 12 } });

    expect(screen.getByText('S01E12')).toBeDefined();
  });

  it('reads Untitled episode when there is no title', () => {
    renderRow({ episode: { title: null } });

    expect(within(row()).getByText('Untitled episode')).toBeDefined();
  });

  it('is named for its code and title, so the row has one clear name', () => {
    renderRow();

    expect(row().getAttribute('aria-label') ?? '').toMatch(
      /S02E04.*The Harvest/
    );
  });

  it('draws the air date under the title when it has one', () => {
    renderRow({ episode: { airDate: 'Mar 4, 2019' } });

    expect(within(row()).getByText('Mar 4, 2019')).toBeDefined();
  });

  it('draws no air date when there is none', () => {
    renderRow({ episode: { airDate: null } });

    expect(screen.queryByText(/\b(19|20)\d\d\b/)).toBeNull();
  });
});

describe('EpisodeRow — the resume bar and label', () => {
  it('draws neither for an episode nobody has started', () => {
    renderRow({ episode: { progress: 0, resumeLabel: null } });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/^Resume/)).toBeNull();
  });

  it('draws the bar on the thumbnail and the Resume label for one part watched', () => {
    renderRow({
      episode: { progress: 25, resumeLabel: 'Resume · 11:00 of 44:00' },
    });

    const bar = within(thumbnail()).getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(screen.getByText('Resume · 11:00 of 44:00')).toBeDefined();
  });

  it('draws neither for a watched episode', () => {
    renderRow({ episode: { watched: true, progress: 0, resumeLabel: null } });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/^Resume/)).toBeNull();
  });
});

describe('EpisodeRow — the thumbnail', () => {
  it('is a 168px 16:9 frame', () => {
    renderRow();

    const style = resolvedStyle(thumbnail());
    expect(style.width).toBe('168px');
    expect(style['aspect-ratio']).toBe(normCss('16 / 9'));
  });

  it('paints the series’ gradient', () => {
    renderRow();

    const painted = [
      thumbnail(),
      ...Array.from(thumbnail().querySelectorAll('*')),
    ]
      .map((element) => {
        const computed = window.getComputedStyle(element);
        return `${computed.backgroundImage} ${computed.background}`;
      })
      .some((bg) => bg.includes('linear-gradient'));
    expect(painted).toBe(true);
  });
});

describe('EpisodeRow — opening it', () => {
  it('is one tab stop with the button role', () => {
    renderRow();

    expect(row().getAttribute('tabindex')).toBe('0');
    row().focus();
    expect(document.activeElement).toBe(row());
  });

  it('calls onOpen when it is clicked', () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.click(row());

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onOpen when Enter is pressed on it', () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.keyDown(row(), { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onOpen when Space is pressed on it', () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.keyDown(row(), { key: ' ' });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('ignores any other key', () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.keyDown(row(), { key: 'ArrowRight' });

    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('EpisodeRow — the watched box', () => {
  it('offers to mark an unwatched episode, unpressed and empty', () => {
    renderRow({ episode: { watched: false } });

    const control = screen.getByRole('button', { name: 'Mark as watched' });
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(control.textContent).not.toContain('✓');
  });

  it('is ticked and pressed for a watched episode, offering to unmark it', () => {
    renderRow({ episode: { watched: true } });

    const control = screen.getByRole('button', {
      name: 'Watched — click to unmark',
    });
    expect(control.getAttribute('aria-pressed')).toBe('true');
    expect(control.textContent).toContain('✓');
  });

  it('is a tab stop of its own, apart from the row', () => {
    renderRow();

    box().focus();

    expect(document.activeElement).toBe(box());
    expect(box()).not.toBe(row());
  });

  it('calls onToggleWatched and never onOpen when it is clicked', () => {
    const onOpen = vi.fn();
    const onToggleWatched = vi.fn();
    renderRow({ onOpen, onToggleWatched });

    fireEvent.click(box());

    expect(onToggleWatched).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
  ])('does not open the row when %s is pressed on it', (_label, key) => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.keyDown(box(), { key });

    expect(onOpen).not.toHaveBeenCalled();
  });
});

/**
 * The two vocabularies, read through the cascade `resolvedStyle` runs, since
 * jsdom computes no `:hover`, `:active` or `:focus-visible`. The row is a
 * **Card** — `cardLift` and `cardFocus`, not the file's own −2px lift and fill
 * change; the box is a **Control** — `controlStates('scale(.92)')`.
 */
describe('EpisodeRow — hover, press and keyboard focus', () => {
  const c = theme.colors;

  it('lifts the row 4px on hover, the Card’s lift and not the file’s −2px', () => {
    renderRow();

    const hover = resolvedStyle(row(), { hover: true });
    expect(hover.transform).toBe(normCss('translateY(-4px)'));
    expect(hover['box-shadow']).toBe(normCss('0 14px 34px rgba(0,0,0,.5)'));
  });

  it('never recolours the row’s fill on hover', () => {
    renderRow();

    const resting = resolvedStyle(row());
    const hover = resolvedStyle(row(), { hover: true });
    expect(hover.background ?? hover['background-color']).toBe(
      resting.background ?? resting['background-color']
    );
  });

  it('draws the Card outline clear of the row under Tab', () => {
    renderRow();

    const focus = resolvedStyle(row(), { focusVisible: true });
    expect(focus.outline).toBe(normCss(`2px solid ${c.focusRing}`));
    expect(focus['outline-offset']).toBe('4px');
  });

  it('presses the box to scale(.92) in 60ms', () => {
    renderRow();

    const press = resolvedStyle(box(), { hover: true, active: true });
    expect(press.transform).toBe(normCss('scale(.92)'));
    expect(press['transition-duration']).toBe('60ms');
  });

  it('rings the box with the 3px focus ring under Tab', () => {
    renderRow();

    const focus = resolvedStyle(box(), { focusVisible: true });
    expect(focus['box-shadow']).toBe(normCss(`0 0 0 3px ${c.focusRing}`));
  });
});
