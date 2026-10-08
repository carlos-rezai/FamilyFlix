import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PillTabs } from './PillTabs';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 29 — Add a series, Phase 2 (issue #262): the **Pill tabs**.
 *
 * The molecule both tab sets are drawn with — the **Library tabs** in the
 * browse header and the **Kind tabs** on the **Movie form**. Extracted from
 * `LibraryTabs`' own track, drawn exactly as it was: two or more `aria-pressed`
 * **Controls** in a labelled `group` on the prototype's pill track.
 * Presentational — it knows no URL; the caller decides what a press writes.
 */

const OPTIONS = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'Series' },
] as const;

function renderTabs(
  value: string = 'movie',
  onChange: (value: string) => void = () => undefined,
  options: readonly { value: string; label: string }[] = OPTIONS
) {
  return render(
    <ThemeProvider theme={theme}>
      <PillTabs
        label="Kind"
        options={options}
        value={value}
        onChange={onChange}
      />
    </ThemeProvider>
  );
}

const group = () => screen.getByRole('group', { name: 'Kind' });
const tab = (name: string) => within(group()).getByRole('button', { name });

describe('PillTabs — the group', () => {
  it('draws one button per option, in order, in a group named by its label', () => {
    renderTabs();

    expect(
      within(group())
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Movie', 'Series']);
  });

  it('draws more than two when given more', () => {
    renderTabs('b', undefined, [
      { value: 'a', label: 'One' },
      { value: 'b', label: 'Two' },
      { value: 'c', label: 'Three' },
    ]);

    expect(within(group()).getAllByRole('button')).toHaveLength(3);
    expect(tab('Two').getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the current option pressed and every other not', () => {
    renderTabs('series');

    expect(tab('Series').getAttribute('aria-pressed')).toBe('true');
    expect(tab('Movie').getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the pressed option’s value', () => {
    const onChange = vi.fn<(value: string) => void>();
    renderTabs('movie', onChange);

    fireEvent.click(tab('Series'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('series');
  });

  it('is presentational: a press does not move the pressed tab by itself', () => {
    renderTabs('movie');

    fireEvent.click(tab('Series'));

    expect(tab('Movie').getAttribute('aria-pressed')).toBe('true');
  });

  it('draws plain buttons that submit nothing', () => {
    renderTabs();

    for (const button of within(group()).getAllByRole('button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });
});

/**
 * Drawn exactly as the library's track was before the extraction —
 * `page.LibraryPage.dc.html`'s pill track and its `tabStyle`.
 */
describe('PillTabs — the pill track, as the library drew it', () => {
  const c = theme.colors;

  it('draws the track: surface fill, soft border, pill corners, 4px in and between', () => {
    renderTabs();

    const track = resolvedStyle(group());
    expect(track.display).toBe('flex');
    expect(track.gap).toBe('4px');
    expect(track.padding).toBe('4px');
    expect(track.background).toBe(normCss(c.surface));
    expect(track.border).toBe(normCss(`1px solid ${c.borderSoft}`));
    expect(track['border-radius']).toBe(theme.radius.pill);
  });

  it('draws each tab 38px tall, 20px either side, in the sans at 15px', () => {
    renderTabs();

    const style = resolvedStyle(tab('Movie'));
    expect(style.height).toBe('38px');
    expect(style.padding).toBe('0 20px');
    expect(style['font-size']).toBe('15px');
    expect(style['font-family']).toBe(normCss(theme.fonts.sans));
    expect(style['border-radius']).toBe(theme.radius.pill);
  });

  it('fills the pressed tab with the accent, in the near-black ink at 700', () => {
    renderTabs('series');

    const style = resolvedStyle(tab('Series'));
    expect(style.background).toBe(normCss(c.accent));
    expect(style.color).toBe('#1a1109');
    expect(style['font-weight']).toBe('700');
  });

  it('leaves the resting tab transparent, in the faint ink at 500', () => {
    renderTabs('series');

    const style = resolvedStyle(tab('Movie'));
    expect(style.background).toBe('transparent');
    expect(style.color).toBe(normCss(c.textFaint));
    expect(style['font-weight']).toBe('500');
  });

  it('presses a tab down in 60ms, as every Control does', () => {
    renderTabs();

    const pressed = resolvedStyle(tab('Series'), { hover: true, active: true });

    expect(pressed['transition-duration']).toBe('60ms');
    expect(pressed.transform).toBe(normCss('scale(.97)'));
  });

  it('draws the accent Focus ring under Tab, and none for a click', () => {
    renderTabs();

    const series = tab('Series');
    expect(resolvedStyle(series, { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${c.focusRing}`)
    );
    expect(resolvedStyle(series, { focus: true })).toEqual(
      resolvedStyle(series)
    );
  });
});
