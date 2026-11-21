import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { Modal } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 71, Busy overlay, Phase 6 (issue #679): `Modal`'s `loader`.
 *
 * Given, the card is `aria-busy`, its idle face (header and ✕ included) stays
 * laid out but hidden, the **Dialog loader** is drawn over it, and the card
 * takes focus, since the button that had it is now hidden. The card is never
 * remounted across the change, and Tab never lands on a hidden button.
 * Absent, `Modal` is as it was, `bare` included.
 */

const LABEL = 'Deleting “Coco”';

interface HostProps {
  loader?: string;
  locked?: boolean;
  bare?: boolean;
  onClose?: () => void;
}

function Host({
  loader,
  locked = false,
  bare = false,
  onClose = () => undefined,
}: HostProps) {
  return (
    <ThemeProvider theme={theme}>
      <Modal
        open
        bare={bare}
        locked={locked}
        loader={loader}
        title="Delete “Coco”?"
        subtitle="This can’t be undone."
        onClose={onClose}
      >
        <p>Every file goes.</p>
        <button type="button">Delete movie</button>
        <button type="button">Cancel</button>
      </Modal>
    </ThemeProvider>
  );
}

const card = () => screen.getByRole('dialog');
const status = () => screen.queryByRole('status', { name: LABEL });

/** A key pressed where a keyboard user presses it: on whatever holds focus. */
const press = (key: string, init: { shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });

describe('Modal with a loader', () => {
  it('is aria-busy and draws the loader’s label inside the card', () => {
    render(<Host loader={LABEL} />);

    expect(card().getAttribute('aria-busy')).toBe('true');
    expect(status()).not.toBeNull();
    expect(card().contains(status())).toBe(true);
  });

  it('keeps the idle face in the document but out of the accessible tree', () => {
    render(<Host loader={LABEL} />);

    expect(within(card()).getByText('Every file goes.')).toBeDefined();
    expect(within(card()).getByText('Delete movie')).toBeDefined();
    expect(within(card()).queryByRole('heading')).toBeNull();
    expect(within(card()).queryByRole('button')).toBeNull();
  });

  it('takes focus onto the card when the loader comes, off the button that had it', () => {
    const { rerender } = render(<Host />);
    within(card()).getByRole('button', { name: 'Cancel' }).focus();

    rerender(<Host loader={LABEL} />);

    expect(document.activeElement).toBe(card());
  });
});

describe('Modal with a loader: the Tab ring', () => {
  it('holds Tab and Shift+Tab inside the card, landing on no hidden button', () => {
    render(<Host loader={LABEL} />);
    expect(document.activeElement).toBe(card());

    press('Tab');
    expect(card().contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.tagName).not.toBe('BUTTON');

    press('Tab', { shiftKey: true });
    expect(card().contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.tagName).not.toBe('BUTTON');
  });
});

describe('Modal with a loader, locked', () => {
  it('asks nothing on Escape or a press on the scrim, the loader still drawn', () => {
    const onClose = vi.fn();
    render(<Host loader={LABEL} locked onClose={onClose} />);

    press('Escape');
    fireEvent.click(card().parentElement as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
    expect(status()).not.toBeNull();
  });
});

describe('Modal from no loader to a loader and back', () => {
  it('keeps the same card element', () => {
    const { rerender } = render(<Host />);
    const before = card();

    rerender(<Host loader={LABEL} />);
    expect(status()).not.toBeNull();
    expect(card()).toBe(before);

    rerender(<Host />);
    expect(status()).toBeNull();
    expect(card()).toBe(before);
  });

  it('gives the idle face back as it was once the loader goes', () => {
    const { rerender } = render(<Host loader={LABEL} />);
    expect(within(card()).queryByRole('button', { name: 'Cancel' })).toBeNull();

    rerender(<Host />);

    expect(card().getAttribute('aria-busy')).not.toBe('true');
    expect(
      within(card()).getByRole('heading', { name: 'Delete “Coco”?' })
    ).toBeDefined();
    expect(within(card()).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(
      within(card()).getByRole('button', { name: 'Cancel' })
    ).toBeDefined();
  });

  it('gives a bare card back as it was once the loader goes', () => {
    const { rerender } = render(<Host bare loader={LABEL} />);
    expect(within(card()).queryByRole('button', { name: 'Cancel' })).toBeNull();

    rerender(<Host bare />);

    expect(card().getAttribute('aria-busy')).not.toBe('true');
    expect(card().getAttribute('aria-label')).toBe('Delete “Coco”?');
    expect(within(card()).queryByRole('heading')).toBeNull();
    expect(within(card()).queryByRole('button', { name: 'Close' })).toBeNull();
    expect(
      within(card()).getByRole('button', { name: 'Cancel' })
    ).toBeDefined();
  });
});
