import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ImportSetup, type ImportSetupProps } from './ImportSetup';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The **Setup step**, from `feat.ImportFlow.dc.html`: two paths typed into
 * two mono fields, and _Start import_. The step is controlled — the values,
 * the two refusals and the three handlers are handed in — so what is under
 * test is the surface: which fields, drawn how, gated on what, and where a
 * refusal is drawn. That a refusal clears on edit and keeps both values is the
 * organism's to prove, because it is the organism that holds the values.
 */

function renderSetup(props: Partial<ImportSetupProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ImportSetup
        sheet=""
        root=""
        sheetError={null}
        rootError={null}
        onSheet={() => undefined}
        onRoot={() => undefined}
        onStart={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

const sheetField = () =>
  screen.getByRole('textbox', { name: 'Spreadsheet' }) as HTMLInputElement;
const rootField = () =>
  screen.getByRole('textbox', {
    name: 'Movies root folder',
  }) as HTMLInputElement;
const startButton = () =>
  screen.getByRole('button', { name: 'Start import' }) as HTMLButtonElement;

/** The box a field is drawn as — the input's own wrapper. */
const boxOf = (input: HTMLInputElement) => input.parentElement as HTMLElement;

const FILLED = { sheet: 'C:\\Movies\\library.xlsx', root: 'C:\\Movies' };

describe('ImportSetup — the two fields', () => {
  it('draws the spreadsheet field and the root field, in that order, with their placeholders', () => {
    renderSetup();

    expect(sheetField().placeholder).toBe('C:\\Movies\\library.xlsx');
    expect(rootField().placeholder).toBe('C:\\Movies');
    expect(comesBefore(sheetField(), rootField())).toBe(true);
  });

  it('shows the values it is handed', () => {
    renderSetup(FILLED);

    expect(sheetField().value).toBe('C:\\Movies\\library.xlsx');
    expect(rootField().value).toBe('C:\\Movies');
  });

  it('reports each field’s new text to its own handler', () => {
    const onSheet = vi.fn();
    const onRoot = vi.fn();
    renderSetup({ onSheet, onRoot });

    fireEvent.change(sheetField(), { target: { value: 'D:\\lib.csv' } });
    fireEvent.change(rootField(), { target: { value: 'D:\\Films' } });

    expect(onSheet).toHaveBeenCalledWith('D:\\lib.csv');
    expect(onRoot).toHaveBeenCalledWith('D:\\Films');
  });

  it('draws both fields mono, 50 high and square-cornered', () => {
    renderSetup();

    // A path is a path: the prototype's `inputStyle` puts both on the mono
    // face, in a 50px box with the soft corner rather than the search bar's
    // pill.
    for (const field of [sheetField(), rootField()]) {
      expect(getComputedStyle(field).fontFamily).toContain('JetBrains Mono');
      expect(getComputedStyle(boxOf(field)).height).toBe('50px');
      expect(getComputedStyle(boxOf(field)).borderRadius).toBe(theme.radius.md);
    }
  });

  it('leads each field with its glyph', () => {
    renderSetup();

    // The sheet glyph on the spreadsheet field, the folder glyph on the root
    // — one svg in each box, and neither announcing anything of its own.
    expect(boxOf(sheetField()).querySelector('svg')).not.toBeNull();
    expect(boxOf(rootField()).querySelector('svg')).not.toBeNull();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });
});

describe('ImportSetup — Start import', () => {
  it('is disabled while both fields are empty', () => {
    renderSetup();

    expect(startButton().disabled).toBe(true);
  });

  it('is disabled while only the spreadsheet is filled', () => {
    renderSetup({ sheet: FILLED.sheet });

    expect(startButton().disabled).toBe(true);
  });

  it('is disabled while only the root is filled', () => {
    renderSetup({ root: FILLED.root });

    expect(startButton().disabled).toBe(true);
  });

  it('is enabled once both are non-empty', () => {
    renderSetup(FILLED);

    expect(startButton().disabled).toBe(false);
  });

  it('starts the import when pressed', () => {
    const onStart = vi.fn();
    renderSetup({ ...FILLED, onStart });

    fireEvent.click(startButton());

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('starts nothing while disabled', () => {
    const onStart = vi.fn();
    renderSetup({ onStart });

    fireEvent.click(startButton());

    expect(onStart).not.toHaveBeenCalled();
  });
});

/**
 * The one invented line in the initiative (design log `13-bulk-import` Q7): a
 * 13px line in the danger colour under the field the refusal names, so a
 * sheet that is not there and a root that is not a folder are told apart on
 * the screen rather than in a snackbar that does not exist yet.
 */
describe('ImportSetup — the refusal line', () => {
  it('draws nothing when neither field is refused', () => {
    renderSetup(FILLED);

    expect(screen.queryByText(/could not/i)).toBeNull();
  });

  it('draws the sheet’s reason under the spreadsheet field, above the root', () => {
    renderSetup({
      ...FILLED,
      sheetError: 'That spreadsheet could not be found.',
    });

    const line = screen.getByText('That spreadsheet could not be found.');
    expect(comesBefore(sheetField(), line)).toBe(true);
    expect(comesBefore(line, rootField())).toBe(true);
  });

  it('draws the root’s reason under the root field, above Start import', () => {
    renderSetup({ ...FILLED, rootError: 'That folder could not be found.' });

    const line = screen.getByText('That folder could not be found.');
    expect(comesBefore(rootField(), line)).toBe(true);
    expect(comesBefore(line, startButton())).toBe(true);
  });

  it('draws the line at 13px in the danger colour', () => {
    renderSetup({
      ...FILLED,
      sheetError: 'That spreadsheet could not be found.',
    });

    const line = screen.getByText('That spreadsheet could not be found.');
    // #c97a6a, as jsdom reports it.
    expect(getComputedStyle(line).fontSize).toBe('13px');
    expect(getComputedStyle(line).color).toBe('rgb(201, 122, 106)');
  });

  it('keeps both values on screen under a refusal', () => {
    renderSetup({
      ...FILLED,
      sheetError: 'That spreadsheet could not be found.',
    });

    expect(sheetField().value).toBe(FILLED.sheet);
    expect(rootField().value).toBe(FILLED.root);
  });
});

/**
 * 22 — Series (TV), Phase 8: "re-runs, year ranges, unnamed shows, the setup
 * panel" (issue #198).
 *
 * _What the scanner accepts_, word for word from `feat.ImportFlow.dc.html`:
 * the three shapes in mono with the prototype's backslashes — the loose
 * shape's note in the sans face — and the folder-first rule, its two tags in
 * mono. It sits under the root field, above _Start import_.
 */
describe('ImportSetup — what the scanner accepts', () => {
  const normalized = (text: string | null) =>
    (text ?? '').replace(/\s+/g, ' ').trim();

  /** The deepest element whose text holds `text` — whatever it is nested in. */
  function innermost(text: string): HTMLElement {
    const holding = Array.from(document.body.querySelectorAll('*')).filter(
      (element) => normalized(element.textContent).includes(text)
    );
    const deepest = holding.filter(
      (element) =>
        !holding.some((other) => other !== element && element.contains(other))
    );
    if (deepest.length !== 1) {
      throw new Error(
        `expected one element holding "${text}", found ${deepest.length}`
      );
    }
    return deepest[0] as HTMLElement;
  }

  const SHAPES = [
    'Movie Title (2019)\ movie.mkv · subs.en.srt',
    'Show Name\ Season 01\ S01E03.mkv',
    'Show Name\ S01E03.mkv',
  ];
  const LOOSE_NOTE = '— loose episodes at the show root are fine';
  const RULE =
    'Season and episode numbers come from the folder first, then the filename (S01E03, 1x03). Anything it can’t place lands in the review list.';

  it('draws its heading under the root field, above Start import', () => {
    renderSetup();

    const heading = screen.getByText('What the scanner accepts');
    expect(comesBefore(rootField(), heading)).toBe(true);
    expect(comesBefore(heading, startButton())).toBe(true);
  });

  it('lists the three shapes, in order, with the prototype’s backslashes', () => {
    renderSetup();

    const text = normalized(document.body.textContent);
    const at = SHAPES.map((shape) => text.indexOf(shape));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain(`${SHAPES[2]} ${LOOSE_NOTE}`);
  });

  it('sets the shapes in mono and the loose shape’s note in the sans face', () => {
    renderSetup();

    for (const shape of SHAPES) {
      expect(getComputedStyle(innermost(shape)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
    expect(getComputedStyle(innermost(LOOSE_NOTE)).fontFamily).toContain(
      'Hanken Grotesk'
    );
  });

  it('states the folder-first rule word for word, after the shapes', () => {
    renderSetup();

    const text = normalized(document.body.textContent);
    expect(text).toContain(RULE);
    expect(text.indexOf(SHAPES[2])).toBeLessThan(text.indexOf(RULE));
  });

  it('sets the rule’s two tags in mono', () => {
    renderSetup();

    for (const tag of ['S01E03', '1x03']) {
      expect(getComputedStyle(screen.getByText(tag)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
  });
});
