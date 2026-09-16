import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FormatCard, type FormatCardProps } from './FormatCard';
import { theme } from '@/styles/theme';

/**
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137).
 *
 * One selectable **Export format** in the **Export dialog**, from
 * `feat.ExportModal.dc.html`, on the `StatTile` pattern: a label, a line under
 * it and an 18px radio dot, on the accent-soft fill when selected. A
 * `role="radio"` button — the two sit in a `role="radiogroup"` named _Format_
 * that the dialog draws around them. The card knows nothing of the export: it
 * draws a label, a line and whether it is the chosen one, and says when it is
 * pressed.
 */
function renderCard(props: Partial<FormatCardProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <div role="radiogroup" aria-label="Format">
        <FormatCard
          label="CSV"
          description="Plain comma-separated. Opens anywhere."
          selected={false}
          onSelect={() => undefined}
          {...props}
        />
      </div>
    </ThemeProvider>
  );
}

const radio = () => screen.getByRole('radio', { name: /CSV/ });

const ACCENT_SOFT_FILL = 'rgba(217, 122, 78, 0.14)';

describe('FormatCard', () => {
  it('renders the label and the description', () => {
    renderCard();

    expect(screen.getByText('CSV')).toBeDefined();
    expect(
      screen.getByText('Plain comma-separated. Opens anywhere.')
    ).toBeDefined();
  });

  it('is a radio, inside the group named Format', () => {
    renderCard();

    const group = screen.getByRole('radiogroup', { name: 'Format' });
    expect(within(group).getByRole('radio', { name: /CSV/ })).toBeDefined();
  });

  it('is a button, so a press does not submit anything', () => {
    renderCard();

    expect(radio().tagName).toBe('BUTTON');
    expect(radio().getAttribute('type')).toBe('button');
  });

  it('is unchecked when not selected', () => {
    renderCard({ selected: false });

    expect(radio().getAttribute('aria-checked')).toBe('false');
  });

  it('is checked when selected', () => {
    renderCard({ selected: true });

    expect(radio().getAttribute('aria-checked')).toBe('true');
  });

  it('calls onSelect on press', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.click(radio());

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect on press even when already selected — the choice is idempotent', () => {
    const onSelect = vi.fn();
    renderCard({ selected: true, onSelect });

    fireEvent.click(radio());

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('sits on the accent-soft fill when selected', () => {
    renderCard({ selected: true });

    expect(getComputedStyle(radio()).backgroundColor).toBe(ACCENT_SOFT_FILL);
  });

  it('does not sit on the accent-soft fill when not selected', () => {
    renderCard({ selected: false });

    expect(getComputedStyle(radio()).backgroundColor).not.toBe(
      ACCENT_SOFT_FILL
    );
  });

  it('draws whichever label and line it is given', () => {
    renderCard({
      label: 'Excel',
      description: '.xlsx workbook with a header row.',
    });

    expect(screen.getByRole('radio', { name: /Excel/ })).toBeDefined();
    expect(screen.getByText('.xlsx workbook with a header row.')).toBeDefined();
  });
});
