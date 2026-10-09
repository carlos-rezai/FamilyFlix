import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import {
  ENRICH_FIELDS,
  type EnrichmentSummary,
  type EnrichField,
} from '@/types';
import { EnrichmentSetup, type EnrichmentSetupProps } from './EnrichmentSetup';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: the three steps have suites.
 *
 * The **Setup step** driven through its props alone, the leaves that asserted
 * only its pixels moved down from `EnrichmentFlow`'s suites: the banners by
 * summary, the scope cards by scope — _Just this movie_ in place of the two —
 * the chips, the notes, _Where it is saved_ over no, one and several **Library
 * folders** (issue #271), the source note, and Start's label, variant and estimate. What the
 * organism decides — which scope, what Start sends, where Back goes — stays in
 * its own suites.
 */

const READY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const ROOT = String.raw`E:\Movies`;
const ARCHIVE = String.raw`F:\Archive`;
const SHEET = 'Metadata sheet in the collection root';
const POSTERS = 'Posters into each movie folder';

function renderSetup(props: Partial<EnrichmentSetupProps> = {}) {
  const handlers = {
    onToggleSheet: vi.fn(),
    onTogglePosters: vi.fn(),
    onChooseScope: vi.fn<EnrichmentSetupProps['onChooseScope']>(),
    onToggleField: vi.fn<(field: EnrichField) => void>(),
    onStart: vi.fn(),
    onRetry: vi.fn(),
    onOpenKeySettings: vi.fn(),
  };
  render(
    <ThemeProvider theme={theme}>
      <EnrichmentSetup
        scope="missing"
        summary={READY}
        title={null}
        fields={ENRICH_FIELDS}
        writeSheet
        writePosters
        letGo={null}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  );
  return handlers;
}

const scopeCard = (name: RegExp) => screen.getByRole('radio', { name });

/** _Where it is saved_'s card, under its label. */
function savedCard(): HTMLElement {
  const next = screen.getByText('Where it is saved').nextElementSibling;
  if (!(next instanceof HTMLElement)) throw new Error('no card');
  return next;
}

const SURFACE = 'rgb(33, 27, 21)';
const BORDER_SOFT = 'rgb(44, 36, 27)';
const TEXT_FAINT = 'rgb(133, 122, 104)';

describe('EnrichmentSetup — the banners', () => {
  it('draws neither when TMDB answered and a key is stored', () => {
    renderSetup();

    expect(screen.queryByText('No internet connection')).toBeNull();
    expect(screen.queryByText('A TMDB API key is needed first')).toBeNull();
  });

  it('says there is no internet connection, and that the library stays', () => {
    renderSetup({ summary: { ...READY, online: false } });

    expect(screen.getByText('No internet connection')).toBeDefined();
    expect(
      screen.getByText(
        'FamilyFlix works fine offline — this is the one feature that needs the network. Everything already in your library stays available.'
      )
    ).toBeDefined();
  });

  it('reports Retry', () => {
    const { onRetry } = renderSetup({ summary: { ...READY, online: false } });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says a key is needed first, and where it goes', () => {
    renderSetup({ summary: { ...READY, keySet: false } });

    expect(screen.getByText('A TMDB API key is needed first')).toBeDefined();
    expect(
      screen.getByText(
        'It’s free and takes a minute. Paste it under Settings → Network, and it stays on this machine.'
      )
    ).toBeDefined();
  });

  it('reports Open Network settings', () => {
    const { onOpenKeySettings } = renderSetup({
      summary: { ...READY, keySet: false },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Network settings' })
    );

    expect(onOpenKeySettings).toHaveBeenCalledTimes(1);
  });

  it('draws both, offline first, with neither a key nor a connection', () => {
    renderSetup({ summary: { ...READY, keySet: false, online: false } });

    const offline = screen.getByText('No internet connection');
    const key = screen.getByText('A TMDB API key is needed first');
    expect(
      offline.compareDocumentPosition(key) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('EnrichmentSetup — the scope cards', () => {
  it('offers Only what’s missing and Everything, and not Just this movie', () => {
    renderSetup();

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(scopeCard(/Only what.s missing/)).toBeDefined();
    expect(scopeCard(/Everything/)).toBeDefined();
    expect(screen.queryByText('Just this movie')).toBeNull();
  });

  it('checks the scope it is given', () => {
    renderSetup({ scope: 'all' });

    expect(scopeCard(/Everything/).getAttribute('aria-checked')).toBe('true');
    expect(scopeCard(/Only what.s missing/).getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('counts each scope’s titles off the summary', () => {
    renderSetup();

    expect(
      within(scopeCard(/Only what.s missing/)).getByText(
        '12 titles have no synopsis or artwork'
      )
    ).toBeDefined();
    expect(
      within(scopeCard(/Everything/)).getByText(
        '30 titles — re-checks ones already filled in'
      )
    ).toBeDefined();
  });

  it('reports the scope chosen', () => {
    const { onChooseScope } = renderSetup();

    fireEvent.click(scopeCard(/Everything/));

    expect(onChooseScope).toHaveBeenCalledWith('all');
  });

  it('draws Just this movie alone for one film, naming it', () => {
    renderSetup({ scope: 'single', title: 'The Lantern Keeper' });

    expect(screen.getAllByRole('radio')).toHaveLength(1);
    const card = scopeCard(/Just this movie/);
    expect(card.getAttribute('aria-checked')).toBe('true');
    expect(within(card).getByText('The Lantern Keeper')).toBeDefined();
  });
});

describe('EnrichmentSetup — the field chips', () => {
  const LABELS = [
    'Synopsis',
    'Poster',
    'Backdrop',
    'Runtime',
    'Year',
    'Genres',
    'Director',
    'Cast',
    'Original title',
    'TMDB score',
  ];

  it('draws the ten in the prototype’s order', () => {
    renderSetup();

    const chips = LABELS.map((label) =>
      screen.getByRole('button', { name: label })
    );
    for (let i = 1; i < chips.length; i += 1) {
      expect(
        chips[i - 1].compareDocumentPosition(chips[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it('presses exactly the chips that are on', () => {
    renderSetup({ fields: ['synopsis', 'cast'] });

    expect(
      screen
        .getByRole('button', { name: 'Synopsis' })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Poster' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('reports the chip toggled', () => {
    const { onToggleField } = renderSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Original title' }));

    expect(onToggleField).toHaveBeenCalledWith('originalTitle');
  });

  it('says the household rating is never touched, and what a series gets', () => {
    renderSetup();

    expect(
      screen.getByText(
        /Your household rating is yours — TMDB’s score is stored beside it, never over it\./
      )
    ).toBeDefined();
    expect(
      screen.getByText(
        'Series get the same fields at show level, plus episode titles, air dates, and stills for every season found on disk.'
      )
    ).toBeDefined();
  });
});

describe('EnrichmentSetup — Where it is saved', () => {
  it('draws the group label in the prototype’s uppercase caption', () => {
    renderSetup();

    const style = getComputedStyle(screen.getByText('Where it is saved'));
    expect(style.fontSize).toBe('12px');
    expect(style.fontWeight).toBe('700');
    expect(style.letterSpacing).toBe('0.9px');
    expect(style.textTransform).toBe('uppercase');
    expect(style.color).toBe(TEXT_FAINT);
  });

  it('draws the card on the surface, with the soft border and 12px corners', () => {
    renderSetup();

    const style = getComputedStyle(savedCard());
    expect(style.backgroundColor).toBe(SURFACE);
    expect(style.borderTopColor).toBe(BORDER_SOFT);
    expect(style.borderRadius).toBe('12px');
  });

  it('draws Your library alone, Required, with no Library folder', () => {
    renderSetup();

    const saved = within(savedCard());
    expect(saved.getByText('Your library')).toBeDefined();
    expect(
      saved.getByText('Always. This is what the app reads from.')
    ).toBeDefined();
    expect(saved.getByText('Required')).toBeDefined();
    expect(saved.queryAllByRole('switch')).toHaveLength(0);
    expect(savedCard().querySelectorAll('svg')).toHaveLength(1);
  });

  it('draws the two Write targets under one Library folder, their paths off it', () => {
    renderSetup({ summary: { ...READY, libraryFolders: [ROOT] } });

    const saved = within(savedCard());
    expect(saved.getByText(`${ROOT}\\familyflix-metadata.csv`)).toBeDefined();
    expect(
      saved.getByText(`${ROOT}\\<movie folder>\\poster.jpg`)
    ).toBeDefined();
  });

  // Issue #271: several Library folders — the lines say where without naming
  // any one folder.
  it('draws the two Write targets in each of several Library folders', () => {
    renderSetup({ summary: { ...READY, libraryFolders: [ROOT, ARCHIVE] } });

    const saved = within(savedCard());
    expect(
      saved.getByText('familyflix-metadata.csv in each library folder')
    ).toBeDefined();
    expect(
      saved.getByText(
        String.raw`<movie folder>\poster.jpg in each library folder`
      )
    ).toBeDefined();
    expect(saved.getAllByRole('switch')).toHaveLength(2);
    expect(saved.queryByText(`${ROOT}\\familyflix-metadata.csv`)).toBeNull();
    expect(saved.queryByText(`${ARCHIVE}\\familyflix-metadata.csv`)).toBeNull();
  });

  it('draws each target’s switch as it is given', () => {
    renderSetup({
      summary: { ...READY, libraryFolders: [ROOT] },
      writeSheet: true,
      writePosters: false,
    });

    expect(
      screen.getByRole('switch', { name: SHEET }).getAttribute('aria-checked')
    ).toBe('true');
    expect(
      screen.getByRole('switch', { name: POSTERS }).getAttribute('aria-checked')
    ).toBe('false');
  });

  it('reports each switch', () => {
    const { onToggleSheet, onTogglePosters } = renderSetup({
      summary: { ...READY, libraryFolders: [ROOT] },
    });

    fireEvent.click(screen.getByRole('switch', { name: SHEET }));
    fireEvent.click(screen.getByRole('switch', { name: POSTERS }));

    expect(onToggleSheet).toHaveBeenCalledTimes(1);
    expect(onTogglePosters).toHaveBeenCalledTimes(1);
  });

  it('says it writes into the movie folders while either target is on', () => {
    renderSetup({
      summary: { ...READY, libraryFolders: [ROOT] },
      writeSheet: false,
      writePosters: true,
    });

    expect(
      screen.getByText(/FamilyFlix will write into your movie folders\./)
    ).toBeDefined();
  });

  it('says nothing of the folders with both targets off', () => {
    renderSetup({
      summary: { ...READY, libraryFolders: [ROOT] },
      writeSheet: false,
      writePosters: false,
    });
    expect(screen.queryByText(/will write into your movie folders/)).toBeNull();
  });
});

describe('EnrichmentSetup — Start', () => {
  it('is Start sync for the library, primary when ready', () => {
    renderSetup();

    const start = screen.getByRole('button', { name: 'Start sync' });
    expect(getComputedStyle(start).backgroundColor).toBe('rgb(217, 122, 78)');
    expect(screen.queryByRole('button', { name: 'Fetch details' })).toBeNull();
  });

  it('is Fetch details for one film', () => {
    renderSetup({ scope: 'single', title: 'The Lantern Keeper' });

    expect(screen.getByRole('button', { name: 'Fetch details' })).toBeDefined();
    expect(screen.getByText('About 1s for 1 title')).toBeDefined();
  });

  it('is secondary while there is no key or no connection', () => {
    renderSetup({ summary: { ...READY, keySet: false } });

    expect(
      getComputedStyle(screen.getByRole('button', { name: 'Start sync' }))
        .backgroundColor
    ).not.toBe('rgb(217, 122, 78)');
  });

  it('estimates the scope it is given', () => {
    renderSetup({ scope: 'all' });

    expect(screen.getByText('About 12s for 30 titles')).toBeDefined();
  });

  it('waits for a connection offline', () => {
    renderSetup({ summary: { ...READY, online: false } });
    expect(screen.getByText('Waiting for a connection')).toBeDefined();
  });

  it('asks for a key when none is set', () => {
    renderSetup({ summary: { ...READY, keySet: false } });
    expect(
      screen.getByText('A key is needed before this can run')
    ).toBeDefined();
  });

  it('reports Start', () => {
    const { onStart } = renderSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Start sync' }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

/**
 * 33 — Single-title Sync (issue #286): the **let-go line**, under Start in the
 * source note's style, while a **Waiting run** has Decisions — and nothing
 * there when the flow passes `null`.
 */
describe('EnrichmentSetup — the let-go line', () => {
  const LINE = 'Starting lets go of the library sync waiting for review.';

  it('draws the line under Start when given one', () => {
    renderSetup({ scope: 'single', title: 'The Lantern Keeper', letGo: LINE });

    const line = screen.getByText(LINE);
    const start = screen.getByRole('button', { name: 'Fetch details' });
    expect(comesBefore(start, line)).toBe(true);
    expect(start.parentElement?.contains(line)).toBe(false);
  });

  it('draws it in the source note’s faint 13px sans', () => {
    renderSetup({ scope: 'single', title: 'The Lantern Keeper', letGo: LINE });

    const style = getComputedStyle(screen.getByText(LINE));
    expect(style.fontSize).toBe('13px');
    expect(style.color).toBe(TEXT_FAINT);
  });

  it('draws no line when given none', () => {
    renderSetup({ scope: 'single', title: 'The Lantern Keeper', letGo: null });

    expect(screen.queryByText(/Starting lets go of/)).toBeNull();
  });
});
