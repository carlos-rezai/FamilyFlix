import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { ENRICH_FIELDS, type EnrichmentSummary } from '@/types';
import { EnrichmentSetup } from './EnrichmentSetup';

/**
 * 58, Folder layout, Phase 10 (issue #543): Where it is saved, without the
 * Write targets.
 *
 * _Where it is saved_ per the amended `feat.EnrichmentFlow.dc.html`: the
 * **Write target** toggles are gone. The card draws _Your library_
 * (_Required_) and _Your library folders_ (_Always_), the second's line the
 * **Images folder** off the one **Library folder** or in each of several, no
 * switch; the note under the card is always drawn.
 */

const READY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 15,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const ROOT = String.raw`E:\Movies`;
const ARCHIVE = String.raw`F:\Archive`;

const NOTE =
  "Art goes into each title folder's Images folder, only where there isn’t one already: nothing of yours is ever replaced. The sheet in Meta is FamilyFlix’s own and is kept up to date.";

function renderSetup(libraryFolders: string[]) {
  render(
    <ThemeProvider theme={theme}>
      <EnrichmentSetup
        scope="missing"
        summary={{ ...READY, libraryFolders }}
        title={null}
        fields={ENRICH_FIELDS}
        letGo={null}
        onChooseScope={vi.fn()}
        onToggleField={vi.fn()}
        onStart={vi.fn()}
        onRetry={vi.fn()}
        onOpenKeySettings={vi.fn()}
      />
    </ThemeProvider>
  );
}

/** _Where it is saved_'s card, under its label. */
function savedCard(): HTMLElement {
  const next = screen.getByText('Where it is saved').nextElementSibling;
  if (!(next instanceof HTMLElement)) throw new Error('no card');
  return next;
}

/** The note under the card, its text with whitespace collapsed. */
function noteText(): string {
  const note = savedCard().nextElementSibling;
  return (note?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The row of the card holding a title, by walking up to its glyph's row. */
function rowOf(title: string): HTMLElement {
  let at: HTMLElement | null = within(savedCard()).getByText(title);
  while (at !== null && at.parentElement !== savedCard()) {
    at = at.parentElement;
  }
  if (at === null) throw new Error(`no row for ${title}`);
  return at;
}

describe('EnrichmentSetup: Where it is saved, in the Folder layout', () => {
  it('draws Your library, Required, and Your library folders, Always, under one Library folder', () => {
    renderSetup([ROOT]);

    const library = within(rowOf('Your library'));
    expect(
      library.getByText('Always. This is what the app reads from.')
    ).toBeDefined();
    expect(library.getByText('Required')).toBeDefined();
    const folders = within(rowOf('Your library folders'));
    expect(
      folders.getByText(String.raw`E:\Movies\<title folder>\Images`)
    ).toBeDefined();
    expect(folders.getByText('Always')).toBeDefined();
  });

  it('says the Images folder is in each of several Library folders', () => {
    renderSetup([ROOT, ARCHIVE]);

    const folders = within(rowOf('Your library folders'));
    expect(
      folders.getByText(
        String.raw`<title folder>\Images in each library folder`
      )
    ).toBeDefined();
    expect(folders.getByText('Always')).toBeDefined();
  });

  it('draws no switch and no Write target', () => {
    renderSetup([ROOT]);

    const saved = within(savedCard());
    expect(saved.queryAllByRole('switch')).toHaveLength(0);
    expect(
      saved.queryByText('Metadata sheet in the collection root')
    ).toBeNull();
    expect(saved.queryByText('Posters into each movie folder')).toBeNull();
    expect(saved.queryByText(/familyflix-metadata\.csv/)).toBeNull();
  });

  it('always draws the note under the card, with a Library folder', () => {
    renderSetup([ROOT]);

    expect(noteText()).toBe(NOTE);
  });

  it('always draws the note under the card, with none', () => {
    renderSetup([]);

    expect(noteText()).toBe(NOTE);
  });
});
