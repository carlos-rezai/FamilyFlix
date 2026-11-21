import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { shownText, visibleLabel } from './visibleLabel';

/** A button with both labels in the document, one of them hidden. */
const twoLabels = (shown: 'idle' | 'busy') => (
  <button type="button">
    <span aria-hidden={shown === 'busy' ? 'true' : undefined}>Save</span>
    <span aria-hidden={shown === 'idle' ? 'true' : undefined}>Saving…</span>
  </button>
);

describe('visibleLabel', () => {
  it('reads only the text outside aria-hidden', () => {
    render(twoLabels('busy'));

    expect(visibleLabel(screen.getByRole('button'))).toBe('Saving…');
  });

  it('reads a plain label whole', () => {
    render(
      <button type="button">
        Add <strong>now</strong>
      </button>
    );

    expect(visibleLabel(screen.getByRole('button'))).toBe('Add now');
  });

  it('reads nothing when the element itself is aria-hidden', () => {
    render(<span aria-hidden="true">gone</span>);

    expect(visibleLabel(screen.getByText('gone'))).toBe('');
  });
});

describe('shownText', () => {
  it('finds a shown label', () => {
    render(twoLabels('busy'));

    expect(shownText('Saving…')).toHaveLength(1);
  });

  it('does not count a hidden label as shown', () => {
    render(twoLabels('idle'));

    expect(screen.queryByText('Saving…')).not.toBeNull();
    expect(shownText('Saving…')).toEqual([]);
  });
});
