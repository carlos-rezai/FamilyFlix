import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — the import path MovieForm, ExportModal and the
// movie detail page's genre tags will all use.
import { Chip, type ChipProps } from '@/primitives';
import { theme } from '@/styles/theme';

function renderChip(props: Partial<ChipProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Chip label={props.label ?? 'Drama'} {...props} />
    </ThemeProvider>
  );
}

describe('Chip', () => {
  it('renders its label', () => {
    const { getByText } = renderChip({ label: 'Drama' });

    expect(getByText('Drama')).toBeTruthy();
  });

  it.each(['sm', 'md'] as const)('keeps its label at size %s', (size) => {
    const { getByText } = renderChip({ label: 'Thriller', size });

    expect(getByText('Thriller')).toBeTruthy();
  });
});

describe('Chip — as a selectable control', () => {
  it('is activatable when given an onClick', () => {
    const onClick = vi.fn();
    renderChip({ label: 'Drama', onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Drama' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reports itself unselected when it is not selected', () => {
    renderChip({ label: 'Drama', onClick: () => undefined });

    expect(
      screen.getByRole('button', { name: 'Drama' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('reports itself selected, so the accent fill is not the only signal', () => {
    renderChip({ label: 'Drama', selected: true, onClick: () => undefined });

    expect(
      screen.getByRole('button', { name: 'Drama' }).getAttribute('aria-pressed')
    ).toBe('true');
  });
});

describe('Chip — as a static tag', () => {
  it('offers no button affordance without an onClick', () => {
    renderChip({ label: 'Drama' });

    // The movie detail page's genre tags are labels, not controls. A tag that
    // is still a button is a tab stop that does nothing when activated.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stays a static tag even when it is selected', () => {
    const { getByText } = renderChip({ label: 'Drama', selected: true });

    expect(getByText('Drama')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
