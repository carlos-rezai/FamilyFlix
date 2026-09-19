import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { CodecRow, type CodecRowProps } from './CodecRow';
import type { CodecRowModel } from '../codecView/codecView';
import { theme } from '@/styles/theme';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * One row of the **Codec report**, from `feat.CodecManager.dc.html` on the
 * `ProblemRow` precedent: the tile with the microchip glyph, the display name,
 * the **Container chips** in mono at 11.5px, the size cell, and the **Status
 * pill** — the faint ink on the third surface for what the machine came with,
 * the watched green for what was added.
 *
 * ---
 *
 * 16 — Playback component upload, Phase 1: "the slot resolves what is live,
 * and it has a row" (issue #152) draws the prototype's row template 1:1, for
 * both kinds of row it serves. `{ row, onRemove? }`: the size cell says
 * whatever the model says — `—` for a codec, a weight for the **Component
 * row** — the pill has four words rather than two, and the `RemoveButton`
 * primitive is drawn exactly when a handler is given and the 32px spacer when
 * it is not.
 *
 * One molecule, not two: a second `ComponentRow` would be two copies of one
 * template. The organism that passes a handler is `CodecManager`, and it
 * passes one for the **Component row** alone.
 */

const row = (overrides: Partial<CodecRowModel> = {}): CodecRowModel => ({
  key: 'h264',
  name: 'H.264 / AVC',
  chips: ['.mp4', '.mov', '.m4v'],
  size: '—',
  status: 'built-in',
  removable: false,
  ...overrides,
});

const installed = (): CodecRowModel =>
  row({
    key: 'hevc',
    name: 'H.265 / HEVC',
    chips: ['.mkv', '.mp4'],
    status: 'installed',
  });

/** The **Component row**: the one row with a size and a source on it. */
const component = (status: 'default' | 'uploaded' = 'default'): CodecRowModel =>
  row({
    key: 'component',
    name: 'Playback component',
    chips: ['ffmpeg.exe', 'ffprobe.exe'],
    size: '94.2 MB',
    status,
    removable: status === 'uploaded',
  });

function renderRow(props: Partial<CodecRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <CodecRow row={props.row ?? row()} onRemove={props.onRemove} />
    </ThemeProvider>
  );
}

/** The last cell of the row: the ✕ when there is one, the spacer when not. */
const lastCell = (container: HTMLElement): HTMLElement =>
  container.firstElementChild?.lastElementChild as HTMLElement;

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

    for (const chip of ['.mp4', '.mov', '.m4v']) {
      const drawn = getComputedStyle(screen.getByText(chip));
      expect(drawn.fontFamily).toContain('JetBrains Mono');
      expect(drawn.fontSize).toBe('11.5px');
    }
  });

  it('shows a dash in the size cell of a codec row', () => {
    // A codec Chromium decodes or the component decodes has no size of its
    // own; the cell is kept so the rows line up under the one that has.
    renderRow();

    expect(screen.getByText('—')).toBeDefined();
  });

  it('shows the size the model carries', () => {
    renderRow({ row: component() });

    expect(screen.getByText('94.2 MB')).toBeDefined();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('shows the component’s two binaries as its chips', () => {
    renderRow({ row: component() });

    expect(screen.getByText('Playback component')).toBeDefined();
    expect(screen.getByText('ffmpeg.exe')).toBeDefined();
    expect(screen.getByText('ffprobe.exe')).toBeDefined();
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
    renderRow({ row: row({ status: 'built-in' }) });

    expect(screen.getByText('Built-in')).toBeDefined();
    expect(screen.queryByText('Installed')).toBeNull();
  });

  it('draws Built-in in the faint ink on the third surface', () => {
    renderRow({ row: row({ status: 'built-in' }) });

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

  it('says Default for the component the machine came with', () => {
    renderRow({ row: component('default') });

    expect(screen.getByText('Default')).toBeDefined();
  });

  it('draws Default in the same colouring as Built-in', () => {
    // The prototype's two colourings, four words: what the machine came with
    // reads faint, what was added reads green.
    renderRow({ row: component('default') });

    const pill = getComputedStyle(screen.getByText('Default'));
    expect(pill.color).toBe(TEXT_FAINT);
    expect(pill.backgroundColor).toBe(SURFACE_3);
  });

  it('says Uploaded for a component the maintainer added', () => {
    renderRow({ row: component('uploaded') });

    expect(screen.getByText('Uploaded')).toBeDefined();
  });

  it('draws Uploaded in the same green as Installed', () => {
    renderRow({ row: component('uploaded') });

    expect(getComputedStyle(screen.getByText('Uploaded')).color).toBe(WATCHED);
  });
});

describe('CodecRow — the remove, when there is one', () => {
  it('draws no button when no handler is given', () => {
    // Nothing in this phase passes one: a codec cannot be removed on its own,
    // and the component's ✕ is Phase 4's.
    renderRow({ row: installed() });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the 32px spacer where the ✕ would sit', () => {
    const { container } = renderRow({ row: installed() });

    expect(lastCell(container).tagName).not.toBe('BUTTON');
    expect(getComputedStyle(lastCell(container)).width).toBe('32px');
  });

  it('draws the ✕ when a handler is given', () => {
    const { container } = renderRow({
      row: component('uploaded'),
      onRemove: vi.fn(),
    });

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(lastCell(container).tagName).toBe('BUTTON');
  });

  it('names the button by what it removes', () => {
    renderRow({ row: component('uploaded'), onRemove: vi.fn() });

    expect(
      screen.getByRole('button', { name: /remove playback component/i })
    ).toBeDefined();
  });

  it('calls the handler when the ✕ is pressed', async () => {
    const onRemove = vi.fn();
    renderRow({ row: component('uploaded'), onRemove });

    await userEvent.click(screen.getByRole('button'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('draws no link and nothing else clickable on a codec row', () => {
    renderRow();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
