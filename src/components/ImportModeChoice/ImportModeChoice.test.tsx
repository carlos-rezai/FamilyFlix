import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ImportModeChoice } from './ImportModeChoice';
import { theme } from '@/styles/theme';
import type { ImportMode } from '@/types';

/**
 * 41 — Link or copy, Slice 3: "a linked film plays" (issue #343).
 *
 * The **Import mode**, `EnrichCheckCard`'s precedent: the 13px caption
 * _Files_ over two `ChoiceCard`s in a `radiogroup` labelled by it —
 *
 * - **Link** — _Play videos where they are. Nothing is copied._
 * - **Copy** — _Keep FamilyFlix’s own copy, playable with the drive unplugged._
 *
 * Presentational: the caller holds the mode (Link on every visit) and the
 * press is handed back as the mode pressed.
 */

const LINK_LINE = 'Play videos where they are. Nothing is copied.';
const COPY_LINE =
  'Keep FamilyFlix’s own copy, playable with the drive unplugged.';

function renderChoice(
  mode: ImportMode = 'link',
  onChange: (mode: ImportMode) => void = () => undefined
) {
  return render(
    <ThemeProvider theme={theme}>
      <ImportModeChoice mode={mode} onChange={onChange} />
    </ThemeProvider>
  );
}

const group = () => screen.getByRole('radiogroup', { name: 'Files' });
const radio = (name: 'Link' | 'Copy') =>
  within(group()).getByRole('radio', { name: new RegExp(`^${name}`) });

describe('ImportModeChoice — radiogroup semantics', () => {
  it('draws the caption Files and names the group by it', () => {
    renderChoice();

    expect(screen.getByText('Files')).toBeDefined();
    expect(group()).toBeDefined();
  });

  it('holds exactly two radios, Link then Copy', () => {
    renderChoice();

    const radios = within(group()).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toBe(radio('Link'));
    expect(radios[1]).toBe(radio('Copy'));
  });

  it('checks only the mode it is given', () => {
    renderChoice('copy');

    expect(radio('Copy').getAttribute('aria-checked')).toBe('true');
    expect(radio('Link').getAttribute('aria-checked')).toBe('false');
  });

  it('hands back copy when Copy is pressed', () => {
    const onChange = vi.fn();
    renderChoice('link', onChange);

    fireEvent.click(radio('Copy'));

    expect(onChange).toHaveBeenCalledWith('copy');
  });

  it('hands back link when Link is pressed', () => {
    const onChange = vi.fn();
    renderChoice('copy', onChange);

    fireEvent.click(radio('Link'));

    expect(onChange).toHaveBeenCalledWith('link');
  });

  it('submits nothing on a press — each radio is a plain button', () => {
    renderChoice();

    for (const name of ['Link', 'Copy'] as const) {
      expect(radio(name).tagName).toBe('BUTTON');
      expect(radio(name).getAttribute('type')).toBe('button');
    }
  });
});

describe('ImportModeChoice — the two lines', () => {
  it('draws Link’s line inside the Link card', () => {
    renderChoice();

    expect(within(radio('Link')).getByText(LINK_LINE)).toBeDefined();
  });

  it('draws Copy’s line inside the Copy card', () => {
    renderChoice();

    expect(within(radio('Copy')).getByText(COPY_LINE)).toBeDefined();
  });
});

describe('ImportModeChoice — Link chosen', () => {
  it('checks Link when the caller holds link', () => {
    renderChoice('link');

    expect(radio('Link').getAttribute('aria-checked')).toBe('true');
    expect(radio('Copy').getAttribute('aria-checked')).toBe('false');
  });
});

/**
 * 48 — Add a show folder, Phase 2 (issue #418): graduated to `components/`,
 * and it can disable Link — for a file under no **Library folder** — the Link
 * card then reading _Only for files inside one of your library folders._ and
 * handing back nothing when pressed. Copy is unchanged.
 */
describe('ImportModeChoice — Link disabled', () => {
  const DISABLED_LINE = 'Only for files inside one of your library folders.';

  const isDisabled = (element: HTMLElement) =>
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true';

  function renderDisabled(
    onChange: (mode: ImportMode) => void = () => undefined
  ) {
    return render(
      <ThemeProvider theme={theme}>
        <ImportModeChoice mode="copy" onChange={onChange} linkDisabled />
      </ThemeProvider>
    );
  }

  it('draws the Link card disabled, reading its line in place of Link’s', () => {
    renderDisabled();

    expect(isDisabled(radio('Link'))).toBe(true);
    expect(within(radio('Link')).getByText(DISABLED_LINE)).toBeDefined();
    expect(within(radio('Link')).queryByText(LINK_LINE)).toBeNull();
  });

  it('hands back nothing when the disabled Link is pressed', () => {
    const onChange = vi.fn();
    renderDisabled(onChange);

    fireEvent.click(radio('Link'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves Copy enabled, with its own line', () => {
    const onChange = vi.fn();
    renderDisabled(onChange);

    expect(isDisabled(radio('Copy'))).toBe(false);
    expect(within(radio('Copy')).getByText(COPY_LINE)).toBeDefined();
    fireEvent.click(radio('Copy'));
    expect(onChange).toHaveBeenCalledWith('copy');
  });

  it('draws Link enabled by default', () => {
    renderChoice();

    expect(isDisabled(radio('Link'))).toBe(false);
  });
});
