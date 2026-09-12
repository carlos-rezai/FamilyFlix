import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import type { ReactNode } from 'react';

import { Modal } from '@/components';
import { theme } from '@/styles/theme';

/**
 * The scrimmed, centred card every dialog in the app is drawn on. What this
 * file carries is the part of the contract the tracer bullet needs — mounting
 * only when open, living in the document body, the header's optional tile, and
 * the ✕. The remaining ways out (Escape, the scrim) and the focus contract are
 * issue #4's, and land beside these.
 *
 * The specimen is the prototype's own: the Export dialog's heading, the one
 * `mol.Modal.dc.html` draws.
 */
interface RenderModalOptions {
  open?: boolean;
  icon?: ReactNode;
  subtitle?: string;
  onClose?: () => void;
}

function renderModal({
  open = true,
  icon,
  subtitle = 'Save your whole collection as a spreadsheet.',
  onClose = () => undefined,
}: RenderModalOptions = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <div data-testid="parent">
        <Modal
          open={open}
          title="Export library"
          subtitle={subtitle}
          icon={icon}
          onClose={onClose}
        >
          <p>Every movie, as one sheet.</p>
        </Modal>
      </div>
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Export library' });

/**
 * The text of everything drawn strictly before the title in reading order,
 * inside the dialog. The icon tile sits there when there is one; when there is
 * not, the title is the first thing the card says.
 */
function drawnBeforeTitle(): string[] {
  const card = dialog();
  const title = within(card).getByRole('heading', { name: 'Export library' });

  return Array.from(card.querySelectorAll('*'))
    .filter((element) => {
      const position = title.compareDocumentPosition(element);
      return (
        Boolean(position & Node.DOCUMENT_POSITION_PRECEDING) &&
        !(position & Node.DOCUMENT_POSITION_CONTAINS)
      );
    })
    .map((element) => element.textContent?.trim() ?? '')
    .filter((text) => text !== '');
}

describe('Modal — mounting', () => {
  it('renders nothing when closed', () => {
    renderModal({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Export library')).toBeNull();
    expect(screen.queryByText('Every movie, as one sheet.')).toBeNull();
  });

  it('renders into the document body when open, not into its parent', () => {
    renderModal();

    // A portal: a scrim inside the detail page's scroll container would scroll
    // with it, so the card lives under `document.body` wherever it was opened.
    const card = dialog();
    expect(screen.getByTestId('parent').contains(card)).toBe(false);
    expect(document.body.contains(card)).toBe(true);
  });

  it('shows the title, the subtitle and the body', () => {
    renderModal();

    const card = dialog();
    expect(
      within(card).getByRole('heading', { name: 'Export library' })
    ).toBeTruthy();
    expect(
      within(card).getByText('Save your whole collection as a spreadsheet.')
    ).toBeTruthy();
    expect(within(card).getByText('Every movie, as one sheet.')).toBeTruthy();
  });
});

describe('Modal — the icon tile', () => {
  it('shows the tile, holding the icon, when one is given', () => {
    renderModal({ icon: '⬇' });

    expect(drawnBeforeTitle()).toEqual(['⬇']);
  });

  it('omits the tile when no icon is given', () => {
    renderModal();

    // Not an empty 44px square beside the title — nothing at all before it.
    expect(drawnBeforeTitle()).toEqual([]);
  });

  it('keeps the icon out of the dialog’s accessible name', () => {
    renderModal({ icon: '⬇' });

    // Labelled by the title alone: the exact-name query is the assertion.
    expect(screen.getByRole('dialog', { name: 'Export library' })).toBeTruthy();
  });
});

describe('Modal — the ✕', () => {
  it('offers a Close button in the card', () => {
    renderModal();

    expect(
      within(dialog()).getByRole('button', { name: 'Close' })
    ).toBeTruthy();
  });

  it('calls onClose when the ✕ is pressed', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for a press inside the card', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByText('Every movie, as one sheet.'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
