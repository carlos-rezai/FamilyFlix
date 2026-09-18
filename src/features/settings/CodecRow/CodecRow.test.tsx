import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { CodecRow, type CodecRowProps } from './CodecRow';
import type { CodecRowModel } from '../codecView/codecView';
import { theme } from '@/styles/theme';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * One **Codec row** of the **Codec report**, from `feat.CodecManager.dc.html`
 * on the `ProblemRow` precedent: the tile with the microchip glyph, the
 * display name, the **Container chips** in mono at 11.5px, a `—` where the
 * prototype's size cell is, and the **Status pill** — _Built-in_ in the faint
 * ink on the third surface for `native`, _Installed_ in the watched green on
 * its own tint for `via-component` — then the 32px spacer where a ✕ would
 * sit. No ✕: a codec cannot be removed on its own, and nothing on the row is a
 * control. The row draws a format and reports nothing.
 */

const row = (overrides: Partial<CodecRowModel> = {}): CodecRowModel => ({
  codec: 'h264',
  name: 'H.264 / AVC',
  exts: ['.mp4', '.mov', '.m4v'],
  support: 'native',
  ...overrides,
});

const installed = (): CodecRowModel =>
  row({
    codec: 'hevc',
    name: 'H.265 / HEVC',
    exts: ['.mkv', '.mp4'],
    support: 'via-component',
  });

function renderRow(props: Partial<CodecRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <CodecRow row={props.row ?? row()} />
    </ThemeProvider>
  );
}

const TEXT_FAINT = 'rgb(133, 122, 104)';
const SURFACE_3 = 'rgb(51, 42, 32)';
const WATCHED = 'rgb(138, 154, 107)';

describe('CodecRow — what it shows', () => {
  it('shows the display name', () => {
    renderRow();

    expect(screen.getByText('H.264 / AVC')).toBeDefined();
  });

  it('shows each container chip, in mono at 11.5px', () => {
    renderRow();

    for (const ext of ['.mp4', '.mov', '.m4v']) {
      const chip = getComputedStyle(screen.getByText(ext));
      expect(chip.fontFamily).toContain('JetBrains Mono');
      expect(chip.fontSize).toBe('11.5px');
    }
  });

  it('shows a dash where the prototype’s size cell is', () => {
    // A codec Chromium decodes or the component decodes has no size of its
    // own; the cell is kept so the rows line up when a pack's row lands.
    renderRow();

    expect(screen.getByText('—')).toBeDefined();
  });

  it('draws the microchip glyph in the tile at 20px', () => {
    const { container } = renderRow();

    const glyph = container.querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute('width')).toBe('20');
    expect(glyph?.getAttribute('height')).toBe('20');
  });
});

describe('CodecRow — the status pill', () => {
  it('says Built-in for a codec Chromium decodes', () => {
    renderRow({ row: row({ support: 'native' }) });

    expect(screen.getByText('Built-in')).toBeDefined();
    expect(screen.queryByText('Installed')).toBeNull();
  });

  it('draws Built-in in the faint ink on the third surface', () => {
    renderRow({ row: row({ support: 'native' }) });

    const pill = getComputedStyle(screen.getByText('Built-in'));
    expect(pill.color).toBe(TEXT_FAINT);
    expect(pill.backgroundColor).toBe(SURFACE_3);
  });

  it('says Installed for a codec the playback component decodes', () => {
    renderRow({ row: installed() });

    expect(screen.getByText('Installed')).toBeDefined();
    expect(screen.queryByText('Built-in')).toBeNull();
  });

  it('draws Installed in the watched green', () => {
    renderRow({ row: installed() });

    expect(getComputedStyle(screen.getByText('Installed')).color).toBe(WATCHED);
  });
});

describe('CodecRow — nothing on it is a control', () => {
  it('offers no button — no ✕, no remove', () => {
    renderRow({ row: installed() });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByTitle('Remove codec')).toBeNull();
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('offers no button for a built-in codec either', () => {
    renderRow();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
