import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { useState, type ReactNode } from 'react';

import { Modal } from '@/components';
import { theme } from '@/styles/theme';

/**
 * The scrimmed, centred card every dialog in the app is drawn on, and the
 * whole of its dismissal contract — the argument `Menu` made, that this is the
 * half that is easy to half-implement: mounting only when open, living in the
 * document body, the header's optional tile, the three ways out (the ✕,
 * Escape, the scrim), where focus lands on open, that Tab is held inside, and
 * where focus goes back to on close.
 *
 * The specimen is the prototype's own: the Export dialog's heading, the one
 * `mol.Modal.dc.html` draws.
 */
interface RenderModalOptions {
  open?: boolean;
  icon?: ReactNode;
  subtitle?: string;
  onClose?: () => void;
  children?: ReactNode;
}

function renderModal({
  open = true,
  icon,
  subtitle = 'Save your whole collection as a spreadsheet.',
  onClose = () => undefined,
  children = <p>Every movie, as one sheet.</p>,
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
          {children}
        </Modal>
      </div>
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Export library' });

/** The scrim is whatever the card sits directly on — reached through the DOM, not a class. */
const scrim = () => dialog().parentElement as HTMLElement;

/** A key pressed where a keyboard user presses it: on whatever holds focus. */
const press = (key: string, init: { shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });

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

describe('Modal — the ARIA dialog pattern', () => {
  it('announces the card as a modal dialog labelled by its title', () => {
    renderModal();

    // The exact-name query is half the assertion: the card is found *as* a
    // dialog *by* its title. The other half is that it says it is modal — a
    // screen reader treats what is behind the scrim as gone.
    const card = dialog();
    const title = within(card).getByRole('heading', { name: 'Export library' });
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('aria-labelledby')).toBe(title.id);
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

describe('Modal — the three ways out', () => {
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

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    press('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose for a press on the scrim', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // The scrim is the card's own backdrop, not the page: a press that lands
    // on it, and on nothing in the card, is the third way out.
    expect(scrim()).not.toBe(document.body);
    fireEvent.click(scrim());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for a press inside the card', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // A press in the body bubbles up through the scrim; the card must be the
    // place it stops, or every click on a form field would shut the dialog.
    fireEvent.click(screen.getByText('Every movie, as one sheet.'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * A body with two buttons, so the card holds three focusables in reading
 * order — the ✕ first, then Export, then Cancel — and both where focus lands
 * on open and the ends of the Tab ring are unambiguous.
 */
function renderWithActions() {
  return renderModal({
    children: (
      <>
        <p>Every movie, as one sheet.</p>
        <button type="button">Export</button>
        <button type="button">Cancel</button>
      </>
    ),
  });
}

const cardButton = (name: string) =>
  within(dialog()).getByRole('button', { name });

describe('Modal — where focus lands when it opens', () => {
  it('puts focus on the card itself', () => {
    renderWithActions();

    // Not the ✕ and not the first button in the body: a reflexive Enter on a
    // dialog that has just opened must do nothing, which is the safe default
    // for a destructive one and costs a harmless one nothing.
    expect(document.activeElement).toBe(dialog());
  });

  it('puts focus on no button', () => {
    renderWithActions();

    expect(document.activeElement?.tagName).not.toBe('BUTTON');
    expect(dialog().contains(document.activeElement)).toBe(true);
  });
});

describe('Modal — holding Tab inside', () => {
  it('wraps Tab from the last focusable to the first', () => {
    renderWithActions();
    cardButton('Cancel').focus();

    press('Tab');

    // Off the end of the card is the scrimmed page, which focus must never
    // reach: the ring closes on the ✕.
    expect(document.activeElement).toBe(cardButton('Close'));
  });

  it('wraps Shift+Tab from the first focusable to the last', () => {
    renderWithActions();
    cardButton('Close').focus();

    press('Tab', { shiftKey: true });

    expect(document.activeElement).toBe(cardButton('Cancel'));
  });
});

/**
 * The modal as a caller actually holds it: a trigger on the page opens it, and
 * `onClose` is what shuts it. The dismissal tests above ask only whether
 * `onClose` was called; what happens *after* a close — where focus goes, that
 * the listeners are gone, that it opens again — needs a modal that really
 * closes, and a trigger that had focus before it opened.
 */
function Host({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <ThemeProvider theme={theme}>
      <button type="button" onClick={() => setOpen(true)}>
        Export library…
      </button>
      <Modal
        open={open}
        title="Export library"
        subtitle="Save your whole collection as a spreadsheet."
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <p>Every movie, as one sheet.</p>
        <button type="button">Export</button>
        <button type="button">Cancel</button>
      </Modal>
    </ThemeProvider>
  );
}

function renderHosted() {
  const onClose = vi.fn();
  render(<Host onClose={onClose} />);
  return onClose;
}

const trigger = () => screen.getByRole('button', { name: 'Export library…' });
const openDialog = () =>
  screen.queryByRole('dialog', { name: 'Export library' });

/** Opens it the way a keyboard user does — focus the trigger, then act. */
function openFromTrigger() {
  const control = trigger();
  control.focus();
  fireEvent.click(control);
  return control;
}

describe('Modal — where focus goes when it closes', () => {
  it('returns focus to the element that had it, after Escape', () => {
    renderHosted();
    const control = openFromTrigger();
    expect(document.activeElement).toBe(openDialog());

    press('Escape');

    expect(openDialog()).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('returns focus to the element that had it, after the ✕', () => {
    renderHosted();
    const control = openFromTrigger();

    // The hardest case: the ✕ itself holds focus when it is pressed, and it is
    // gone with the card a moment later. Focus must not fall to the body.
    const close = cardButton('Close');
    close.focus();
    fireEvent.click(close);

    expect(openDialog()).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('returns focus to the element that had it, after the scrim', () => {
    renderHosted();
    const control = openFromTrigger();

    fireEvent.click(scrim());

    expect(openDialog()).toBeNull();
    expect(document.activeElement).toBe(control);
  });
});

describe('Modal — reopening', () => {
  it('can be opened again after every way of closing it', () => {
    renderHosted();

    openFromTrigger();
    press('Escape');
    openFromTrigger();
    fireEvent.click(scrim());
    openFromTrigger();
    fireEvent.click(cardButton('Close'));
    openFromTrigger();

    expect(openDialog()).not.toBeNull();
    expect(document.activeElement).toBe(openDialog());
  });

  it('stops listening once it is shut, so a stray Escape costs nothing', () => {
    const onClose = renderHosted();
    openFromTrigger();
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);

    // Focus is on the trigger and the card is gone; a second Escape must not
    // throw, ask to close again, or re-run the focus return against nothing.
    press('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openDialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});

// --- 14 — Export, Phase 1: "the tracer bullet" (issue #137) -------------------
//
// `bare`: the card is the children — no header, no ✕, no body padding — and
// `title` becomes the card's `aria-label` instead of the heading it labelled.
// The **Export dialog**'s done face is the app's one **Bare modal**: it swaps
// its content inside the same card so the pop-in runs once, and the prototype
// draws that face with no header at all. Everything else the Modal owns —
// Escape, the scrim, focus in and back out, Tab held — is unchanged, and so is
// a caller that does not ask for it.

function renderBare({
  onClose = () => undefined,
  children = (
    <>
      <h2>Export ready</h2>
      <p>Saved family-library.csv with 3 movies to your computer.</p>
      <button type="button">Done</button>
    </>
  ),
}: { onClose?: () => void; children?: ReactNode } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Modal open bare title="Export ready" onClose={onClose}>
        {children}
      </Modal>
    </ThemeProvider>
  );
}

const bareDialog = () => screen.getByRole('dialog', { name: 'Export ready' });

describe('Modal bare — the card is the children', () => {
  it('draws no heading of its own', () => {
    renderBare({ children: <p>Only this.</p> });

    // The card's name is the `title`, but nothing on screen spells it: a
    // heading drawn above the done face would be the header the prototype
    // does not have.
    expect(within(bareDialog()).queryByRole('heading')).toBeNull();
    expect(screen.queryByText('Export ready')).toBeNull();
  });

  it('draws no ✕', () => {
    renderBare();

    expect(
      within(bareDialog()).queryByRole('button', { name: 'Close' })
    ).toBeNull();
    expect(within(bareDialog()).queryByText('✕')).toBeNull();
  });

  it('shows the children as the whole card', () => {
    renderBare();

    const card = bareDialog();
    expect(
      within(card).getByRole('heading', { name: 'Export ready' })
    ).toBeTruthy();
    expect(
      within(card).getByText(
        'Saved family-library.csv with 3 movies to your computer.'
      )
    ).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('carries the title as the card’s accessible name, by aria-label', () => {
    renderBare();

    const card = bareDialog();
    expect(card.getAttribute('aria-label')).toBe('Export ready');
    expect(card.getAttribute('aria-labelledby')).toBeNull();
    expect(card.getAttribute('aria-modal')).toBe('true');
  });

  it('draws the children with no body padding', () => {
    renderBare({ children: <p data-testid="only">Only this.</p> });

    // The card's own inner box is the prototype's: 36px 32px on the done face,
    // drawn by the children. Nothing between the card and the children adds
    // padding of its own.
    const card = bareDialog();
    const child = screen.getByTestId('only');
    let node = child.parentElement;
    while (node !== null && node !== card) {
      const style = getComputedStyle(node);
      expect(style.paddingTop).toMatch(/^(0px|)$/);
      expect(style.paddingLeft).toMatch(/^(0px|)$/);
      node = node.parentElement;
    }
    expect(node).toBe(card);
  });
});

describe('Modal bare — the ways out that remain', () => {
  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    renderBare({ onClose });

    press('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose for a press on the scrim', () => {
    const onClose = vi.fn();
    renderBare({ onClose });

    fireEvent.click(bareDialog().parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for a press inside the card', () => {
    const onClose = vi.fn();
    renderBare({ onClose });

    fireEvent.click(within(bareDialog()).getByText('Export ready'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

/** A bare modal as the Export dialog holds it: opened from a row, shut by Done. */
function BareHost() {
  const [open, setOpen] = useState(false);

  return (
    <ThemeProvider theme={theme}>
      <button type="button" onClick={() => setOpen(true)}>
        Export to CSV
      </button>
      <Modal
        open={open}
        bare
        title="Export ready"
        onClose={() => setOpen(false)}
      >
        <h2>Export ready</h2>
        <button type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </Modal>
    </ThemeProvider>
  );
}

describe('Modal bare — focus', () => {
  it('moves focus onto the card when it opens', () => {
    render(<BareHost />);
    const row = screen.getByRole('button', { name: 'Export to CSV' });
    row.focus();

    fireEvent.click(row);

    expect(document.activeElement).toBe(bareDialog());
  });

  it('moves focus back to the element that had it, after Done', () => {
    render(<BareHost />);
    const row = screen.getByRole('button', { name: 'Export to CSV' });
    row.focus();
    fireEvent.click(row);

    const done = within(bareDialog()).getByRole('button', { name: 'Done' });
    done.focus();
    fireEvent.click(done);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('moves focus back after Escape', () => {
    render(<BareHost />);
    const row = screen.getByRole('button', { name: 'Export to CSV' });
    row.focus();
    fireEvent.click(row);

    press('Escape');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('holds Tab inside the card', () => {
    renderBare();
    const done = within(bareDialog()).getByRole('button', { name: 'Done' });

    // Done is the only focusable, so Tab off it wraps back onto it.
    done.focus();
    press('Tab');
    expect(document.activeElement).toBe(done);

    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(done);
  });
});

describe('Modal — a caller that does not ask for bare', () => {
  it('still draws the header, the ✕ and the labelled heading', () => {
    renderModal();

    const card = dialog();
    expect(
      within(card).getByRole('heading', { name: 'Export library' })
    ).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(card.getAttribute('aria-labelledby')).toBeTruthy();
    expect(card.getAttribute('aria-label')).toBeNull();
  });
});
