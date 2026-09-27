import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EnrichmentFlow } from './EnrichmentFlow';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 7: "remember the library root and source folders"
 * (issue #210).
 *
 * Setup's _Where it is saved_, from `feat.EnrichmentFlow.dc.html`: the
 * uppercase group label over one card, and in it the first **Write target**,
 * _Your library_ — a **Write target row**: the 38px glyph tile (the database
 * glyph), the title, _Always. This is what the app reads from._, and the
 * _Required_ pill where a Toggle would sit, because the library is written
 * whatever is chosen. The two optional targets in the **Library root** are
 * the next phase's, and are not drawn when no root is remembered (log 23
 * Q37), so here _Your library_ is the card's only row.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const READY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>((input) => {
    if (path(input) === '/api/enrichment') {
      return Promise.resolve(okResponse(READY));
    }
    if (path(input) === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: null }));
    }
    return Promise.resolve(notFoundResponse('No sync is running'));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/enrich']}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const SURFACE = 'rgb(33, 27, 21)';
const SURFACE_3 = 'rgb(51, 42, 32)';
const BORDER = 'rgb(58, 48, 36)';
const BORDER_SOFT = 'rgb(44, 36, 27)';
const TEXT = 'rgb(243, 236, 224)';
const TEXT_DIM = 'rgb(182, 169, 148)';
const TEXT_FAINT = 'rgb(133, 122, 104)';

/** The group label, once the summary has landed and setup is drawn. */
const heading = () => screen.findByText('Where it is saved');

/** The card under the label. */
async function card(): Promise<HTMLElement> {
  const label = await heading();
  const next = label.nextElementSibling;
  if (!(next instanceof HTMLElement))
    throw new Error('no card under the label');
  return next;
}

function expectBorder(style: CSSStyleDeclaration, colour: string) {
  for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
    expect(style[`border${side}Width`]).toBe('1px');
    expect(style[`border${side}Style`]).toBe('solid');
    expect(style[`border${side}Color`]).toBe(colour);
  }
}

describe('EnrichmentSetup — Where it is saved', () => {
  it('draws the group label in the prototype’s uppercase caption', async () => {
    renderFlow();

    const style = getComputedStyle(await heading());
    expect(style.fontSize).toBe('12px');
    expect(style.fontWeight).toBe('700');
    expect(style.letterSpacing).toBe('0.9px');
    expect(style.textTransform).toBe('uppercase');
    expect(style.color).toBe(TEXT_FAINT);
  });

  it('lists Your library, always, as Required', async () => {
    renderFlow();

    const saved = within(await card());
    expect(saved.getByText('Your library')).toBeDefined();
    expect(
      saved.getByText('Always. This is what the app reads from.')
    ).toBeDefined();
    expect(saved.getByText('Required')).toBeDefined();
  });

  it('offers no switch for Your library — it cannot be turned off', async () => {
    renderFlow();

    expect(within(await card()).queryAllByRole('switch')).toHaveLength(0);
  });

  it('draws Your library as the only target while no root is remembered', async () => {
    renderFlow();

    const saved = within(await card());
    expect(saved.queryByText('familyflix-metadata.csv')).toBeNull();
    expect(saved.queryByText(/poster\.jpg/)).toBeNull();
    expect((await card()).querySelectorAll('svg')).toHaveLength(1);
  });

  it('draws the card on the surface, with the soft border and 12px corners', async () => {
    renderFlow();

    const style = getComputedStyle(await card());
    expect(style.backgroundColor).toBe(SURFACE);
    expectBorder(style, BORDER_SOFT);
    expect(style.borderRadius).toBe('12px');
  });

  it('draws the title at 15px 600 over the line at 13px in the faint ink', async () => {
    renderFlow();

    const saved = within(await card());
    const title = getComputedStyle(saved.getByText('Your library'));
    expect(title.fontSize).toBe('15px');
    expect(title.fontWeight).toBe('600');
    expect(title.color).toBe(TEXT);
    const line = getComputedStyle(
      saved.getByText('Always. This is what the app reads from.')
    );
    expect(line.fontSize).toBe('13px');
    expect(line.color).toBe(TEXT_FAINT);
  });

  it('draws the glyph in a 38px tile with 9px corners', async () => {
    renderFlow();

    const glyph = (await card()).querySelector('svg');
    const tile = glyph?.parentElement;
    if (!tile) throw new Error('no glyph tile');
    const style = getComputedStyle(tile);
    expect(style.width).toBe('38px');
    expect(style.height).toBe('38px');
    expect(style.borderRadius).toBe('9px');
    expect(style.backgroundColor).toBe(SURFACE_3);
    expect(style.color).toBe(TEXT_DIM);
  });

  it('draws Required as the prototype’s pill', async () => {
    renderFlow();

    const style = getComputedStyle(within(await card()).getByText('Required'));
    expect(style.fontSize).toBe('12px');
    expect(style.fontWeight).toBe('600');
    expect(style.color).toBe(TEXT_FAINT);
    expect(style.backgroundColor).toBe(SURFACE_3);
    expectBorder(style, BORDER);
    expect(style.paddingTop).toBe('4px');
    expect(style.paddingBottom).toBe('4px');
    expect(style.paddingLeft).toBe('11px');
    expect(style.paddingRight).toBe('11px');
    expect(style.borderRadius).toBe('999px');
  });
});
