import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { useState } from 'react';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import {
  useSnackbar,
  type SnackbarNotice,
} from '@/App/useSnackbar/useSnackbar';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 18 — Snackbar system, Phase 2: "the tracer bullet" (issue #161).
 *
 * The **Snackbar stack** and its queue, proven the way `GenreMovies` proves a
 * provider: a small consumer rendered under the real one, driven through the
 * hook, and what is on screen read back — which notices are present, in what
 * order, after what elapsed. `notify` lands a card drawn by the molecule with
 * the variant's glyph and role; it is gone at 5s and not before; the ✕ and
 * `dismiss(id)` take it off early; two notices stack newest nearest the
 * corner; two identical notices are two; nothing is capped, deduped or
 * coalesced; every outstanding timer is cleared on unmount.
 *
 * The stack is `fixed` bottom-right at `z-index: 200`, `pointer-events: none`
 * with each card's wrapper restoring `auto`, always mounted — empty or not —
 * and carrying no live region and no role of its own: the roles are on the
 * cards alone. No portal: it renders where the provider sits, above the route
 * table, so a notice raised on one route is still there on the next.
 *
 * Phase 3, "the action persists, and pressing it dismisses then runs" (issue
 * #162), is the one exception to the timer rule and the one thing the stack
 * does on a caller's behalf. An **Actionable snackbar** — a notice whose
 * `action` is present — gets no timer and persists until it is actioned or
 * dismissed; every other notice still dies at 5s. Pressing the action takes
 * its own notice off first, then runs `onClick`; the ✕ takes it off without
 * running `onClick`; `dismiss(id)` retracts one nobody pressed and does
 * nothing against one already actioned. The action's presence is the whole of
 * the timing: `SnackbarNotice` carries no `duration` and no `dismissible`.
 */
const FIVE_SECONDS = 5_000;
const WELL_BEYOND = 10 * 60_000;

const SAVED: SnackbarNotice = { variant: 'success', message: 'Saved.' };
const REFUSED: SnackbarNotice = {
  variant: 'error',
  title: 'Could not save',
  message: 'The folder is read-only.',
};

/** The one actionable notice the app will ever push, the Update offer. */
const OFFER_MESSAGE = 'FamilyFlix 1.1.0 is ready to install.';
function offer(onClick: () => void = () => undefined): SnackbarNotice {
  return {
    variant: 'info',
    title: 'Update available',
    message: OFFER_MESSAGE,
    action: { label: 'Update now', onClick },
  };
}

/** The hook's answer, captured off the last render of a consumer under it. */
let api: ReturnType<typeof useSnackbar>;

function Consumer() {
  api = useSnackbar();
  return null;
}

function renderStack() {
  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <Consumer />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

/** The stack's node: always in the tree, empty or not. */
const stack = (): HTMLElement => snackbarStack();

/** Every card in the stack, in document order. */
const cards = (): HTMLElement[] => [
  ...within(stack()).queryAllByRole('status'),
  ...within(stack()).queryAllByRole('alert'),
];

/** The card that carries this message. */
function cardSaying(message: string): HTMLElement {
  const card = screen
    .getByText(message)
    .closest('[role="status"], [role="alert"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error(`no card says "${message}"`);
  }
  return card;
}

/** The stack's direct child that wraps this card. */
function wrapperOf(card: HTMLElement): HTMLElement {
  const wrapper = Array.from(stack().children).find((child) =>
    child.contains(card)
  );
  if (!(wrapper instanceof HTMLElement)) {
    throw new Error('the card is not in the stack');
  }
  return wrapper;
}

function raise(notice: SnackbarNotice): number {
  let id = -1;
  act(() => {
    id = api.notify(notice);
  });
  return id;
}

function elapse(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SnackbarProvider — notify lands a card', () => {
  it('draws the notice by the molecule, with the variant’s glyph and role', () => {
    renderStack();

    raise(SAVED);

    const card = within(stack()).getByRole('status');
    expect(within(card).getByText('Saved.')).toBeDefined();
    expect(card.querySelector('svg')).not.toBeNull();
    expect(within(card).getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });

  it('draws a warning or an error as an alert, with its title', () => {
    renderStack();

    raise(REFUSED);

    const card = within(stack()).getByRole('alert');
    expect(within(card).getByText('Could not save')).toBeDefined();
    expect(within(card).getByText('The folder is read-only.')).toBeDefined();
    expect(within(stack()).queryByRole('status')).toBeNull();
  });

  it('passes an action’s label through to the molecule', () => {
    renderStack();

    raise({
      variant: 'info',
      message: 'FamilyFlix 1.1.0 is ready to install.',
      action: { label: 'Update', onClick: () => undefined },
    });

    expect(
      within(stack()).getByRole('button', { name: 'Update' })
    ).toBeDefined();
  });

  it('answers a number id', () => {
    renderStack();

    const id = raise(SAVED);

    expect(typeof id).toBe('number');
  });
});

describe('SnackbarProvider — the 5s rule', () => {
  it('keeps the notice on screen until 5s', () => {
    renderStack();
    raise(SAVED);

    elapse(FIVE_SECONDS - 1);

    expect(screen.getByText('Saved.')).toBeDefined();
  });

  it('takes the notice off at 5s', () => {
    renderStack();
    raise(SAVED);

    elapse(FIVE_SECONDS);

    expect(screen.queryByText('Saved.')).toBeNull();
    expect(cards()).toHaveLength(0);
  });

  it('times each notice from its own raising', () => {
    renderStack();
    raise(SAVED);
    elapse(3_000);
    raise(REFUSED);

    elapse(2_000);
    expect(screen.queryByText('Saved.')).toBeNull();
    expect(screen.getByText('The folder is read-only.')).toBeDefined();

    elapse(3_000);
    expect(screen.queryByText('The folder is read-only.')).toBeNull();
  });
});

describe('SnackbarProvider — taking a notice off early', () => {
  it('takes a notice off by its ✕ before its 5s', () => {
    renderStack();
    raise(SAVED);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Saved.')).toBeNull();
    expect(cards()).toHaveLength(0);
  });

  it('takes only the pressed notice off, leaving the other', () => {
    renderStack();
    raise(SAVED);
    raise(REFUSED);

    fireEvent.click(
      within(cardSaying('Saved.')).getByRole('button', { name: 'Dismiss' })
    );

    expect(screen.queryByText('Saved.')).toBeNull();
    expect(screen.getByText('The folder is read-only.')).toBeDefined();
  });

  it('retracts a notice nobody pressed through dismiss(id)', () => {
    renderStack();
    const id = raise(SAVED);
    raise(REFUSED);

    act(() => {
      api.dismiss(id);
    });

    expect(screen.queryByText('Saved.')).toBeNull();
    expect(screen.getByText('The folder is read-only.')).toBeDefined();
  });

  it('does nothing, and throws nothing, on an id that is already gone', () => {
    renderStack();
    const id = raise(SAVED);
    raise(REFUSED);
    act(() => {
      api.dismiss(id);
    });

    expect(() =>
      act(() => {
        api.dismiss(id);
      })
    ).not.toThrow();
    expect(() =>
      act(() => {
        api.dismiss(9_999);
      })
    ).not.toThrow();
    expect(screen.getByText('The folder is read-only.')).toBeDefined();
  });

  it('is not dismissed by Escape', () => {
    renderStack();
    raise(SAVED);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(cardSaying('Saved.'), { key: 'Escape' });
    fireEvent.keyUp(document.body, { key: 'Escape' });

    expect(screen.getByText('Saved.')).toBeDefined();
  });
});

describe('SnackbarProvider — the queue', () => {
  it('holds two notices at once, the newest nearest the corner', () => {
    renderStack();
    raise(SAVED);
    raise(REFUSED);

    expect(cards()).toHaveLength(2);
    // Oldest-first in the document, and the column is reversed, so the last
    // raised is the one at the bottom edge.
    expect(
      comesBefore(cardSaying('Saved.'), cardSaying('The folder is read-only.'))
    ).toBe(true);
  });

  it('keeps document order oldest-first past the first pair', () => {
    renderStack();
    raise({ variant: 'info', message: 'First' });
    raise({ variant: 'info', message: 'Second' });
    raise({ variant: 'info', message: 'Third' });

    expect(comesBefore(cardSaying('First'), cardSaying('Second'))).toBe(true);
    expect(comesBefore(cardSaying('Second'), cardSaying('Third'))).toBe(true);
  });

  it('treats two identical notices as two notices', () => {
    renderStack();
    raise(SAVED);
    raise(SAVED);

    expect(screen.getAllByText('Saved.')).toHaveLength(2);
    expect(cards()).toHaveLength(2);
  });

  it('answers a different id for each of two identical notices, and each comes off alone', () => {
    renderStack();
    const first = raise(SAVED);
    const second = raise(SAVED);
    expect(second).not.toBe(first);

    act(() => {
      api.dismiss(first);
    });

    expect(screen.getAllByText('Saved.')).toHaveLength(1);
  });

  it('caps nothing: a dozen notices are a dozen cards', () => {
    renderStack();
    for (let n = 0; n < 12; n += 1) {
      raise({ variant: 'info', message: `Notice ${n}` });
    }

    expect(cards()).toHaveLength(12);
  });
});

describe('SnackbarProvider — the timers', () => {
  it('clears every outstanding timer on unmount, so nothing fires afterwards', () => {
    const { unmount } = renderStack();
    raise(SAVED);
    raise(REFUSED);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => elapse(FIVE_SECONDS * 2)).not.toThrow();
  });

  it('clears a dismissed notice’s timer with it', () => {
    renderStack();
    const id = raise(SAVED);

    act(() => {
      api.dismiss(id);
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('SnackbarProvider — an actionable notice persists', () => {
  it('keeps a notice with an action on screen at 5s', () => {
    renderStack();
    raise(offer());

    elapse(FIVE_SECONDS);

    expect(screen.getByText(OFFER_MESSAGE)).toBeDefined();
    expect(
      within(stack()).getByRole('button', { name: 'Update now' })
    ).toBeDefined();
  });

  it('keeps it well beyond: still up ten minutes later', () => {
    renderStack();
    raise(offer());

    elapse(WELL_BEYOND);

    expect(screen.getByText(OFFER_MESSAGE)).toBeDefined();
    expect(cards()).toHaveLength(1);
  });

  it('arms no timer for it: the action’s presence is the timing', () => {
    renderStack();

    raise(offer());

    expect(vi.getTimerCount()).toBe(0);
  });

  it('still takes a notice without an action off at 5s, beside one that stays', () => {
    renderStack();
    raise(SAVED);
    raise(offer());

    elapse(FIVE_SECONDS);

    expect(screen.queryByText('Saved.')).toBeNull();
    expect(screen.getByText(OFFER_MESSAGE)).toBeDefined();
    expect(cards()).toHaveLength(1);
  });

  it('has no duration and no dismissible: a stray one changes nothing', () => {
    renderStack();
    const hurried: SnackbarNotice = {
      variant: 'info',
      message: 'Hurried',
      // @ts-expect-error — a SnackbarNotice carries no `duration`
      duration: 100,
    };
    const locked: SnackbarNotice = {
      ...offer(),
      // @ts-expect-error — a SnackbarNotice carries no `dismissible`
      dismissible: false,
    };
    raise(hurried);
    raise(locked);

    elapse(100);
    expect(screen.getByText('Hurried')).toBeDefined();

    elapse(FIVE_SECONDS - 100);
    expect(screen.queryByText('Hurried')).toBeNull();
    expect(screen.getByText(OFFER_MESSAGE)).toBeDefined();
    expect(
      within(cardSaying(OFFER_MESSAGE)).getByRole('button', {
        name: 'Dismiss',
      })
    ).toBeDefined();
  });
});

describe('SnackbarProvider — pressing the action', () => {
  /** What the action does, captured off the last render of a consumer. */
  let install: () => void;

  /** A consumer whose action has a visible effect on screen. */
  function Installer() {
    api = useSnackbar();
    const [installing, setInstalling] = useState(false);
    install = () => setInstalling(true);
    return installing ? <p>Installing and restarting…</p> : null;
  }

  function renderInstaller() {
    return render(
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Installer />
        </SnackbarProvider>
      </ThemeProvider>
    );
  }

  it('takes its own notice off first, then runs onClick: gone by the time the effect shows', () => {
    renderInstaller();
    const onClick = vi.fn(() => install());
    raise(offer(onClick));
    elapse(FIVE_SECONDS * 2);

    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));

    expect(screen.getByText('Installing and restarting…')).toBeDefined();
    expect(screen.queryByText(OFFER_MESSAGE)).toBeNull();
    expect(cards()).toHaveLength(0);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes only its own notice off, leaving the other', () => {
    renderStack();
    const onClick = vi.fn();
    raise(offer(onClick));
    raise({
      ...offer(),
      message: 'Another offer.',
      action: { label: 'Later', onClick: () => undefined },
    });
    elapse(FIVE_SECONDS * 2);

    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));

    expect(screen.queryByText(OFFER_MESSAGE)).toBeNull();
    expect(screen.getByText('Another offer.')).toBeDefined();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SnackbarProvider — taking an actionable notice off', () => {
  it('takes it off by its ✕, past the 5s a plain one dies at, without running onClick', () => {
    renderStack();
    const onClick = vi.fn();
    raise(offer(onClick));
    elapse(FIVE_SECONDS * 2);

    fireEvent.click(
      within(cardSaying(OFFER_MESSAGE)).getByRole('button', {
        name: 'Dismiss',
      })
    );

    expect(screen.queryByText(OFFER_MESSAGE)).toBeNull();
    expect(cards()).toHaveLength(0);
    elapse(WELL_BEYOND);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('retracts one nobody pressed through dismiss(id)', () => {
    renderStack();
    const onClick = vi.fn();
    const id = raise(offer(onClick));
    elapse(FIVE_SECONDS * 2);
    expect(screen.getByText(OFFER_MESSAGE)).toBeDefined();

    act(() => {
      api.dismiss(id);
    });

    expect(screen.queryByText(OFFER_MESSAGE)).toBeNull();
    expect(cards()).toHaveLength(0);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does nothing through dismiss(id) against one already actioned', () => {
    renderStack();
    const onClick = vi.fn();
    const id = raise(offer(onClick));
    raise({
      ...offer(),
      message: 'Another offer.',
      action: { label: 'Later', onClick: () => undefined },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(screen.queryByText(OFFER_MESSAGE)).toBeNull();
    expect(cards()).toHaveLength(1);

    expect(() =>
      act(() => {
        api.dismiss(id);
      })
    ).not.toThrow();

    expect(cards()).toHaveLength(1);
    expect(screen.getByText('Another offer.')).toBeDefined();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaks nothing when the provider unmounts with one up', () => {
    const { unmount } = renderStack();
    const onClick = vi.fn();
    raise(offer(onClick));
    elapse(FIVE_SECONDS * 2);
    expect(screen.getByText(OFFER_MESSAGE)).toBeDefined();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => elapse(WELL_BEYOND)).not.toThrow();
    expect(screen.queryByText(OFFER_MESSAGE)).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('SnackbarProvider — the stack’s node', () => {
  it('is present when empty, and paints nothing', () => {
    renderStack();

    expect(stack()).toBeDefined();
    expect(stack().childElementCount).toBe(0);
    expect(stack().textContent).toBe('');
    expect(cards()).toHaveLength(0);
  });

  it('is fixed bottom-right above the scrim, a reversed column', () => {
    renderStack();

    const drawn = getComputedStyle(stack());
    expect(drawn.position).toBe('fixed');
    expect(drawn.right).toBe('24px');
    expect(drawn.bottom).toBe('24px');
    expect(drawn.zIndex).toBe('200');
    expect(drawn.display).toBe('flex');
    expect(drawn.flexDirection).toBe('column-reverse');
    expect(drawn.gap).toBe('12px');
    expect(drawn.alignItems).toBe('flex-end');
  });

  it('lets pointer events through itself, and each card’s wrapper takes them back', () => {
    renderStack();
    raise(SAVED);

    expect(getComputedStyle(stack()).pointerEvents).toBe('none');
    expect(
      getComputedStyle(wrapperOf(cardSaying('Saved.'))).pointerEvents
    ).toBe('auto');
  });

  it('carries no live region and no role: the roles are on the cards alone', () => {
    renderStack();
    raise(SAVED);

    expect(stack().hasAttribute('aria-live')).toBe(false);
    expect(stack().hasAttribute('role')).toBe(false);
    expect(within(stack()).getByRole('status')).toBeDefined();
  });

  it('is no portal: it renders where the provider sits', () => {
    const { container } = renderStack();
    raise(SAVED);

    expect(container.contains(stack())).toBe(true);
    expect(container.contains(cardSaying('Saved.'))).toBe(true);
  });
});

describe('SnackbarProvider — above the route table', () => {
  function Screen({ name, to }: { name: string; to: string }) {
    return (
      <>
        <h1>{name}</h1>
        <Link to={to}>go</Link>
      </>
    );
  }

  function renderRoutes() {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/']}>
          <SnackbarProvider>
            <Consumer />
            <Routes>
              <Route path="/" element={<Screen name="Home" to="/settings" />} />
              <Route
                path="/settings"
                element={<Screen name="Settings" to="/" />}
              />
            </Routes>
          </SnackbarProvider>
          <LocationProbe />
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  it('keeps a notice raised on one route on screen after navigating to another', () => {
    renderRoutes();
    raise(SAVED);
    expect(screen.getByRole('heading', { name: 'Home' })).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'go' }));

    expect(pathname()).toBe('/settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    expect(screen.getByText('Saved.')).toBeDefined();
  });

  it('neither suppresses nor re-parents the stack across routes', () => {
    renderRoutes();
    const before = stack();

    fireEvent.click(screen.getByRole('link', { name: 'go' }));

    expect(stack()).toBe(before);
    expect(stack().parentElement).toBe(before.parentElement);
  });

  it('still times the notice out after the route change', () => {
    renderRoutes();
    raise(SAVED);
    fireEvent.click(screen.getByRole('link', { name: 'go' }));

    elapse(FIVE_SECONDS);

    expect(screen.queryByText('Saved.')).toBeNull();
  });
});
