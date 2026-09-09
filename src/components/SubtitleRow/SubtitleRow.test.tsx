import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { SubtitleRow, type SubtitleRowProps } from '@/components';
import { theme } from '@/styles/theme';

/**
 * The **Language pool** as the **Movie form** hands it over: a display
 * vocabulary, not an entity. The molecule is handed the list rather than
 * knowing it, which is what keeps it a molecule — it never learns that a
 * **Movie** has subtitles at all.
 */
const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
];

function renderRow(props: Partial<SubtitleRowProps> = {}) {
  const onLanguageChange = vi.fn<(language: string) => void>();
  const onRemove = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <SubtitleRow
        filename="lantern.en.srt"
        language="English"
        languages={LANGUAGES}
        onLanguageChange={onLanguageChange}
        onRemove={onRemove}
        {...props}
      />
    </ThemeProvider>
  );

  return { onLanguageChange, onRemove };
}

/** The row's language control, found by the name a screen reader announces. */
const trigger = (name = 'Language for lantern.en.srt: English') =>
  screen.getByRole('button', { name });

/** One row of the open panel. */
const option = (name: string) => screen.getByRole('menuitem', { name });

/** Every row of the open panel, in the order it is drawn. */
const options = () =>
  screen.queryAllByRole('menuitem').map((row) => row.textContent);

/** Opens the language list the way a keyboard user does. */
function openLanguages(name?: string) {
  const control = trigger(name);
  control.focus();
  fireEvent.click(control);
  return control;
}

/**
 * One **Subtitle row** from `mol.SubtitleRow.dc.html`: the file's name, the
 * language it is in, and the ✕ that takes it off the movie.
 *
 * **Its dropdown is a `Menu`**, for exactly the reason `FilterDropdown` gave:
 * `Menu` already owns Escape, a press outside, select-to-close and focus
 * return, and taking it means only one language menu can be open at a time for
 * free, with no coordinating state here and nothing to re-test. So this file
 * deliberately does **not** assert Escape, press-outside or select-to-close —
 * `Menu.test.tsx` owns all three, and re-asserting them here would be testing
 * the same implementation twice under a second name. What only one row can be
 * open at a time *looks like* is asserted where two rows exist, in
 * `MovieFormFiles.test.tsx`.
 *
 * Composition only: it knows nothing about **Movies**, saves, or where the
 * seven languages came from.
 */
describe('SubtitleRow', () => {
  it('shows the name of the file in the slot', () => {
    renderRow();

    // Story 26 needs the maintainer to be able to tell which track they are
    // labelling, and the filename is the only thing a browser will say about a
    // **Picked file**.
    expect(screen.getByText('lantern.en.srt')).toBeDefined();
  });

  it('shows the language the track is currently in', () => {
    renderRow({ language: 'Portuguese', filename: 'lantern.pt.srt' });

    expect(
      trigger('Language for lantern.pt.srt: Portuguese').textContent
    ).toContain('Portuguese');
  });

  it('carries the filename in the control’s accessible name', () => {
    renderRow();

    // A column of these reads as a column of identical "English ▾" buttons to
    // anything that cannot see the row. The filename is the only thing that
    // tells one row's language control from the next one's.
    expect(trigger()).toBeDefined();
  });

  it('offers no language list until the control is pressed', () => {
    renderRow();

    expect(options()).toEqual([]);
  });

  it('offers the whole pool it was handed, in the order it was handed', () => {
    renderRow();

    openLanguages();

    // The list is the caller's, not this molecule's: the seven are a display
    // vocabulary the **Movie form** owns, and a row that knew them would be a
    // molecule with a domain in it.
    expect(options()).toEqual(LANGUAGES);
  });

  it('marks the language the row is standing on', () => {
    renderRow({ language: 'French' });

    openLanguages('Language for lantern.en.srt: French');

    // `MenuItem`'s `selected`, which is also where focus lands as the panel
    // opens — so the list opens standing on the language it is already showing.
    expect(option('French').getAttribute('aria-current')).toBe('true');
    expect(option('German').getAttribute('aria-current')).toBeNull();
  });

  it('reports the language that was chosen', () => {
    const { onLanguageChange } = renderRow();

    openLanguages();
    fireEvent.click(option('Portuguese'));

    // The name itself, not an index and not a code: a **Subtitle**'s language
    // is stored as the chosen text.
    expect(onLanguageChange).toHaveBeenCalledWith('Portuguese');
    expect(onLanguageChange).toHaveBeenCalledTimes(1);
  });

  it('reports a language even when it is the one already shown', () => {
    const { onLanguageChange } = renderRow();

    openLanguages();
    fireEvent.click(option('English'));

    // A marked row still reports, like every other row of every `Menu`. What
    // the caller does with a language that did not change is the caller's
    // business, and nothing here needs to guess at it.
    expect(onLanguageChange).toHaveBeenCalledWith('English');
  });

  it('names the removal after the file it takes off', () => {
    renderRow({ filename: 'lantern.pt.srt' });

    // `FileField`'s own rule at a rung where there is genuinely a column of
    // them: the ✕s are identical, and the name is what makes pressing the right
    // one possible at all.
    expect(
      screen.getByRole('button', { name: /remove lantern\.pt\.srt/i })
    ).toBeDefined();
  });

  it('reports the removal without taking the row away itself', () => {
    const { onRemove } = renderRow();

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    // Which rows exist lives one level up, in the form's values — this says the
    // ✕ was pressed and nothing about what that means.
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByText('lantern.en.srt')).toBeDefined();
  });

  it('reports nothing at all until something is pressed', () => {
    const { onLanguageChange, onRemove } = renderRow();

    expect(onLanguageChange).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
