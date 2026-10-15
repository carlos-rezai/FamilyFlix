import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import type { SeasonChoice } from '@/types';
import { SeasonChoices } from './SeasonChoices';

/**
 * 42 — Review at scale, Slice 7: "choose a season's poster from TMDB" (issue
 * #364). `feat.EnrichmentFlow.dc.html`'s Seasons section, §5a's **Seasons**
 * bullet.
 *
 * The Group heading _Seasons_, then one card per **Season choice**: a group
 * labelled _Posters for S02_ holding the held tile — `S02` over the held
 * Season poster, else the gradient, captioned _Current poster_ or _No poster
 * yet_ — then up to ten `CandidatePicker`-style cards with no title, meta or
 * score, the series' marked _Series poster_, each an `aria-pressed` button
 * named _Poster 2 for S02_ / _Series poster 5 for S02_. A press reports
 * `onChoose(season, path)`. `{ seasons, onChoose }`, nothing more.
 */

const tmdb = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

const choice = (path: string, source: 'season' | 'series') => ({
  path,
  url: tmdb(path),
  source,
});

const SEASON_ONE: SeasonChoice = {
  season: 1,
  posterUrl: '/api/images/the-hollow-coast-2018/S01-poster.jpg',
  choices: [
    choice('/s01-a.jpg', 'season'),
    choice('/s01-b.jpg', 'season'),
    choice('/show-1.jpg', 'series'),
  ],
};

const SEASON_TWO: SeasonChoice = {
  season: 2,
  posterUrl: null,
  choices: [choice('/show-1.jpg', 'series'), choice('/show-2.jpg', 'series')],
};

function renderChoices(seasons: SeasonChoice[] = [SEASON_ONE, SEASON_TWO]) {
  const onChoose = vi.fn<(season: number, path: string) => void>();
  render(
    <ThemeProvider theme={theme}>
      <SeasonChoices seasons={seasons} onChoose={onChoose} />
    </ThemeProvider>
  );
  return onChoose;
}

const pickerFor = (label: string) =>
  screen.getByRole('group', { name: `Posters for ${label}` });

/** Every painted background in the held tile's part of a picker. */
function heldPaints(picker: HTMLElement): string[] {
  const buttons = within(picker).queryAllByRole('button');
  return [picker, ...Array.from(picker.querySelectorAll('*'))]
    .filter(
      (element) =>
        !buttons.some(
          (button) => button === element || button.contains(element)
        )
    )
    .map((element) => {
      const computed = window.getComputedStyle(element);
      return `${computed.backgroundImage} ${computed.background} ${
        element instanceof HTMLImageElement ? element.src : ''
      }`;
    });
}

/** Whether a choice draws its TMDB image, as an `<img>` or a background. */
function drawsImage(button: HTMLElement, url: string): boolean {
  return [button, ...Array.from(button.querySelectorAll('*'))].some(
    (element) => {
      if (element instanceof HTMLImageElement) return element.src === url;
      const computed = window.getComputedStyle(element);
      return `${computed.backgroundImage} ${computed.background}`.includes(url);
    }
  );
}

describe('SeasonChoices — the section', () => {
  it('draws the Group heading Seasons', () => {
    renderChoices();

    expect(screen.getByText('Seasons')).toBeTruthy();
  });

  it('draws one labelled picker per season, in the order given', () => {
    renderChoices();

    const groups = screen
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('Posters for'));
    expect(groups).toEqual(['Posters for S01', 'Posters for S02']);
  });

  it('draws nothing for no seasons', () => {
    renderChoices([]);

    expect(screen.queryByText('Seasons')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('SeasonChoices — the held tile', () => {
  it('draws S02 over the tile, two digits at least', () => {
    renderChoices();

    expect(within(pickerFor('S01')).getByText('S01')).toBeTruthy();
    expect(within(pickerFor('S02')).getByText('S02')).toBeTruthy();
  });

  it('paints the held Season poster, captioned Current poster', () => {
    renderChoices();

    const picker = pickerFor('S01');
    expect(
      heldPaints(picker).some((paint) =>
        paint.includes('/api/images/the-hollow-coast-2018/S01-poster.jpg')
      )
    ).toBe(true);
    expect(within(picker).getByText('Current poster')).toBeTruthy();
  });

  it('paints the gradient alone with no poster, captioned No poster yet', () => {
    renderChoices();

    const picker = pickerFor('S02');
    const paints = heldPaints(picker);
    expect(paints.some((paint) => paint.includes('linear-gradient'))).toBe(
      true
    );
    expect(paints.some((paint) => paint.includes('/api/images/'))).toBe(false);
    expect(within(picker).getByText('No poster yet')).toBeTruthy();
    expect(within(picker).queryByText('Current poster')).toBeNull();
  });
});

describe('SeasonChoices — the choices', () => {
  it('names each choice by its place and season, the series’ as Series poster', () => {
    renderChoices();

    expect(
      within(pickerFor('S01'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual([
      'Poster 1 for S01',
      'Poster 2 for S01',
      'Series poster 3 for S01',
    ]);
    expect(
      within(pickerFor('S02'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Series poster 1 for S02', 'Series poster 2 for S02']);
  });

  it('draws each choice’s TMDB image', () => {
    renderChoices();

    const buttons = within(pickerFor('S01')).getAllByRole('button');
    SEASON_ONE.choices.forEach((each, i) => {
      expect(drawsImage(buttons[i] as HTMLElement, each.url)).toBe(true);
    });
  });

  it('marks only the series’ posters with the Series poster pill', () => {
    renderChoices();

    const [own, , series] = within(pickerFor('S01')).getAllByRole('button');
    expect(
      within(series as HTMLElement).getByText('Series poster')
    ).toBeTruthy();
    expect(within(own as HTMLElement).queryByText('Series poster')).toBeNull();
  });

  it('draws no title, meta or score on a choice', () => {
    renderChoices();

    for (const button of within(pickerFor('S01')).getAllByRole('button')) {
      expect(button.textContent?.trim() ?? '').toMatch(/^(Series poster)?$/);
      expect(button.textContent ?? '').not.toMatch(/%|match/i);
    }
  });

  it('draws at most ten choices', () => {
    const many: SeasonChoice = {
      season: 3,
      posterUrl: null,
      choices: Array.from({ length: 12 }, (_, i) =>
        choice(`/s03-${i + 1}.jpg`, i < 8 ? 'season' : 'series')
      ),
    };
    renderChoices([many]);

    expect(within(pickerFor('S03')).getAllByRole('button')).toHaveLength(10);
  });

  it('is an aria-pressed button, none pressed before a press', () => {
    renderChoices();

    for (const button of within(pickerFor('S01')).getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
  });
});

describe('SeasonChoices — a press', () => {
  it('reports the season and the choice’s path', () => {
    const onChoose = renderChoices();

    fireEvent.click(
      screen.getByRole('button', { name: 'Series poster 3 for S01' })
    );

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(1, '/show-1.jpg');
  });

  it('marks the pressed choice as the season’s pick, and that season’s alone', () => {
    renderChoices();

    fireEvent.click(screen.getByRole('button', { name: 'Poster 2 for S01' }));

    expect(
      within(pickerFor('S01'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-pressed'))
    ).toEqual(['false', 'true', 'false']);
    expect(
      within(pickerFor('S02'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-pressed'))
    ).toEqual(['false', 'false']);
  });
});
