import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { ExpandableText, type ExpandableTextProps } from '@/components';
import { theme } from '@/styles/theme';

const SHORT = 'A lighthouse keeper takes in a runaway girl.';

const LONG =
  'A lighthouse keeper on a fading coast takes in a runaway girl, and the two ' +
  'slowly rebuild a family out of the wreckage of the season. As winter closes ' +
  'the harbor and the supply boats stop coming, they learn that the light they ' +
  'tend is the only thing keeping either of them from drifting out to sea. A ' +
  'quiet, tender story about the families we choose when the ones we were given ' +
  'have gone dark.';

/**
 * jsdom does no layout, so it reports `scrollHeight` and `clientHeight` as 0 for
 * everything and the clamp is never overflowing. These stubs supply the two
 * numbers the component reads, which is the only way the *decision* under test
 * — did a toggle appear — can be driven at all. Nothing here asserts how the
 * component measures; a build that measures in a layout effect, a
 * `ResizeObserver`, or a `requestAnimationFrame` passes identically.
 */
const layout = { scrollHeight: 0, clientHeight: 0 };

/** The element is clamped and the copy does not fit — a toggle is warranted. */
function reportOverflowing() {
  layout.scrollHeight = 320;
  layout.clientHeight = 100;
}

/** The copy fits inside the clamp, or the element is unclamped and free to grow. */
function reportFitting() {
  layout.scrollHeight = 100;
  layout.clientHeight = 100;
}

beforeEach(() => {
  reportFitting();
  for (const prop of ['scrollHeight', 'clientHeight'] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => layout[prop],
    });
  }
  // Not implemented by jsdom; a no-op keeps a ResizeObserver-based build from
  // throwing on mount without prescribing that it use one.
  if (!('ResizeObserver' in globalThis)) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      }
    );
  }
});

afterEach(() => {
  // Own properties on HTMLElement.prototype shadowing jsdom's own accessors on
  // Element.prototype — deleting them restores the real ones.
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
  delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
  vi.unstubAllGlobals();
});

function renderText(props: Partial<ExpandableTextProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ExpandableText text={props.text ?? LONG} {...props} />
    </ThemeProvider>
  );
}

describe('ExpandableText', () => {
  it('renders the copy it was given', () => {
    const { getByText } = renderText({ text: SHORT });

    expect(getByText(SHORT)).toBeTruthy();
  });

  it('offers no toggle at all for copy that fits', () => {
    reportFitting();
    renderText({ text: SHORT });

    // Not a disabled button, not a "Read more" with nothing behind it — a
    // toggle that does nothing is worse than no toggle.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a "Read more" for copy that overflows the clamp', async () => {
    reportOverflowing();
    renderText({ text: LONG, lines: 4 });

    const toggle = await screen.findByRole('button', { name: 'Read more' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('ExpandableText — toggling', () => {
  it('swaps the label to "Show less" and reports itself expanded', async () => {
    reportOverflowing();
    renderText({ text: LONG, lines: 4 });

    fireEvent.click(await screen.findByRole('button', { name: 'Read more' }));

    const toggle = screen.getByRole('button', { name: 'Show less' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the toggle once expanded, so the copy can be collapsed again', async () => {
    reportOverflowing();
    renderText({ text: LONG, lines: 4 });

    fireEvent.click(await screen.findByRole('button', { name: 'Read more' }));
    // An unclamped element no longer overflows — it grew to fit. A component
    // that re-measures while expanded concludes the copy was short all along
    // and drops the toggle, stranding the reader in the expanded state.
    reportFitting();
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));

    const toggle = screen.getByRole('button', { name: 'Read more' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
