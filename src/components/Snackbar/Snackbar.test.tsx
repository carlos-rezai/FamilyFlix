import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import {
  Snackbar,
  type SnackbarProps,
  type SnackbarVariant,
} from '@/components';
import { theme } from '@/styles/theme';

/**
 * 18 — Snackbar system, Phase 1: "the molecule" (issue #160).
 *
 * The transient bottom-right card, from `mol.Snackbar.dc.html`, proven by
 * rendering it and reading what is on screen: one **Snackbar variant** drawn
 * as the accent bar, the glyph and the action's border off the matching status
 * token — `error` reading `danger` — and as the card's role, `status` for the
 * two that can wait their turn and `alert` for the two that interrupt (log 17
 * Q20). An optional bold title over the dim message, an optional bordered
 * action, and the card's own 28px ✕ announcing itself as **Dismiss**.
 *
 * Presentational to the last prop: it owns no timer and no effect, and the
 * thing that unmounts it is the **Snackbar stack**, which the next slice
 * builds. The specimen is the prototype's own — the **Update offer snackbar**'s
 * copy — and nothing here reaches for a class or a state variable.
 */
const TITLE = 'Update available';
const MESSAGE = 'FamilyFlix 1.1.0 is ready to install.';
const ACTION = 'Update';

function renderSnackbar(props: Partial<SnackbarProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Snackbar variant="info" message={MESSAGE} {...props} />
    </ThemeProvider>
  );
}

/** The card is whatever carries the role — a status or an alert, by variant. */
const card = (): HTMLElement =>
  screen.queryByRole('status') ?? screen.getByRole('alert');

/** The glyph: the one svg the card draws, next to the accent bar. */
function glyph(): SVGSVGElement {
  const svg = card().querySelector('svg');
  if (svg === null) {
    throw new Error('the card drew no glyph');
  }
  return svg;
}

/** Every path the glyph is drawn with, so a variant is told by its picture. */
const strokes = (): string[] =>
  Array.from(glyph().querySelectorAll('path')).map(
    (path) => path.getAttribute('d') ?? ''
  );

/**
 * The accent bar: the one thing in the card that is 4px wide — reached by its
 * geometry rather than a class, because the geometry is the prototype's.
 */
function accentBar(): HTMLElement {
  const bar = Array.from(card().querySelectorAll('*')).find(
    (node) => getComputedStyle(node).width === '4px'
  );
  if (bar === undefined) {
    throw new Error('the card drew no 4px accent bar');
  }
  return bar as HTMLElement;
}

const dismiss = () => within(card()).getByRole('button', { name: 'Dismiss' });
const action = () => within(card()).getByRole('button', { name: ACTION });

/** A token as jsdom reports it back. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The variant → colour map is the prototype's: `error` reads `danger`. */
const COLOUR: Record<SnackbarVariant, string> = {
  info: rgb(theme.colors.info),
  success: rgb(theme.colors.success),
  warning: rgb(theme.colors.warning),
  error: rgb(theme.colors.danger),
};

/** The line that tells each glyph from the other three, off the prototype's SVG. */
const GLYPH_STROKE: Record<SnackbarVariant, string> = {
  info: 'M12 11v5',
  success: 'M8 12.5l2.5 2.5L16 9.5',
  warning: 'M12 3.5l9 16H3l9-16z',
  error: 'M15 9l-6 6M9 9l6 6',
};

const VARIANTS: SnackbarVariant[] = ['info', 'success', 'warning', 'error'];

afterEach(() => {
  vi.useRealTimers();
});

describe('Snackbar — the variant, as a glyph and a role', () => {
  it.each(VARIANTS)('%s draws its own glyph', (variant) => {
    renderSnackbar({ variant });

    expect(strokes()).toContain(GLYPH_STROKE[variant]);
    for (const other of VARIANTS.filter((v) => v !== variant)) {
      expect(strokes()).not.toContain(GLYPH_STROKE[other]);
    }
  });

  it.each(['info', 'success'] as const)(
    '%s is a status: a confirmation waits its turn',
    (variant) => {
      renderSnackbar({ variant });

      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );

  it.each(['warning', 'error'] as const)(
    '%s is an alert: a refusal interrupts',
    (variant) => {
      renderSnackbar({ variant });

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.queryByRole('status')).toBeNull();
    }
  );

  it('keeps the glyph decorative, so the picture is not a second sentence', () => {
    renderSnackbar({ variant: 'error' });

    expect(glyph().getAttribute('aria-hidden')).toBe('true');
    expect(glyph().getAttribute('role')).toBeNull();
  });
});

describe('Snackbar — the variant, as a colour', () => {
  it.each(VARIANTS)('%s paints the accent bar in its colour', (variant) => {
    renderSnackbar({ variant });

    expect(getComputedStyle(accentBar()).backgroundColor).toBe(COLOUR[variant]);
  });

  it.each(VARIANTS)('%s inks the glyph in its colour', (variant) => {
    renderSnackbar({ variant });

    expect(getComputedStyle(glyph()).color).toBe(COLOUR[variant]);
  });

  it.each(VARIANTS)(
    '%s borders the action button in its colour, and writes it the same',
    (variant) => {
      renderSnackbar({ variant, actionLabel: ACTION });

      const drawn = getComputedStyle(action());
      expect(drawn.borderTopColor).toBe(COLOUR[variant]);
      expect(drawn.color).toBe(COLOUR[variant]);
    }
  );

  it('reads the danger token for error, not one of its own', () => {
    renderSnackbar({ variant: 'error', actionLabel: ACTION });

    expect(getComputedStyle(accentBar()).backgroundColor).toBe(
      rgb(theme.colors.danger)
    );
    expect(getComputedStyle(action()).borderTopColor).toBe(
      rgb(theme.colors.danger)
    );
  });
});

describe('Snackbar — the title and the message', () => {
  it('always draws the message', () => {
    renderSnackbar();

    expect(within(card()).getByText(MESSAGE)).toBeDefined();
  });

  it('draws the message dim at 14px', () => {
    renderSnackbar();

    const drawn = getComputedStyle(within(card()).getByText(MESSAGE));
    expect(drawn.fontSize).toBe('14px');
    expect(drawn.color).toBe(rgb(theme.colors.textDim));
  });

  it('draws a title as the bold line above the message', () => {
    renderSnackbar({ title: TITLE });

    const title = within(card()).getByText(TITLE);
    const message = within(card()).getByText(MESSAGE);

    const drawn = getComputedStyle(title);
    expect(drawn.fontWeight).toBe('600');
    expect(drawn.fontSize).toBe('15px');
    expect(drawn.color).toBe(rgb(theme.colors.text));

    expect(
      Boolean(
        message.compareDocumentPosition(title) &
        Node.DOCUMENT_POSITION_PRECEDING
      )
    ).toBe(true);
  });

  it('draws no line at all without a title: the message is the first thing the card says', () => {
    renderSnackbar();

    expect(within(card()).queryByText(TITLE)).toBeNull();
    expect(card().textContent?.trim().startsWith(MESSAGE)).toBe(true);
  });
});

describe('Snackbar — the action', () => {
  it('draws a button carrying the label, and pressing it asks onAction', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    renderSnackbar({ actionLabel: ACTION, onAction, onDismiss });

    await user.click(action());

    expect(onAction).toHaveBeenCalledTimes(1);
    // Dismissing on action is the stack's to wire, not the molecule's.
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('draws no button without a label', () => {
    renderSnackbar({ onAction: vi.fn() });

    expect(within(card()).queryByRole('button', { name: ACTION })).toBeNull();
    expect(within(card()).getAllByRole('button')).toHaveLength(1);
  });
});

describe('Snackbar — the ✕', () => {
  it('is present by default and announces itself as Dismiss', () => {
    renderSnackbar();

    expect(dismiss()).toBeDefined();
  });

  it('asks onDismiss when pressed, and nothing else', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    renderSnackbar({ actionLabel: ACTION, onAction, onDismiss });

    await user.click(dismiss());

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('is reachable by Tab, after the action', async () => {
    const user = userEvent.setup();
    renderSnackbar({ actionLabel: ACTION });

    await user.tab();
    expect(document.activeElement).toBe(action());

    await user.tab();
    expect(document.activeElement).toBe(dismiss());
  });

  it('is 28px square', () => {
    renderSnackbar();

    const drawn = getComputedStyle(dismiss());
    expect(drawn.width).toBe('28px');
    expect(drawn.height).toBe('28px');
  });

  it('is not drawn when dismissible is false', () => {
    renderSnackbar({ dismissible: false, onDismiss: vi.fn() });

    expect(
      within(card()).queryByRole('button', { name: 'Dismiss' })
    ).toBeNull();
    expect(within(card()).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('Snackbar — the card', () => {
  it('is 360px, shrinking to the window rather than scrolling it sideways', () => {
    renderSnackbar();

    const drawn = getComputedStyle(card());
    expect(drawn.width).toBe('360px');
    expect(drawn.maxWidth).toBe('calc(100vw - 48px)');
  });

  it('enters on ffSnackIn', () => {
    renderSnackbar();

    expect(getComputedStyle(card()).animation).toMatch(
      /^ffSnackIn 0?\.26s ease$/
    );
  });

  it('has no reduced-motion branch: the entry is the one animation there is', () => {
    renderSnackbar();

    const injected = Array.from(document.querySelectorAll('style'))
      .map((sheet) => sheet.textContent ?? '')
      .join('\n');
    expect(injected).not.toContain('prefers-reduced-motion');
  });

  it('owns no timer and no effect: nothing in it unmounts itself', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    renderSnackbar({ onDismiss });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(card()).toBeDefined();
    expect(within(card()).getByText(MESSAGE)).toBeDefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
