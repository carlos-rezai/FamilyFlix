import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Profiler } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { BackToTop, type BackToTopProps } from '@/components';
import { theme } from '@/styles/theme';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';
import { stubScrollTo } from '@/test-support/stubScrollTo/stubScrollTo';

/**
 * 19 — Back-to-top FAB, Phase 2: "the control" (issue #167).
 *
 * **Back-to-top** over a container the test owns: the control reads the
 * container's `scrollTop` on every passive `scroll` event and once on attach,
 * and mounts the **FAB** named _Back to top_ past the **Scroll threshold** —
 * `scrollTop > 420`, strictly, `page.LibraryPage`'s number — or nothing under
 * it. A press asks the container, and only the container, for the top.
 *
 * The container is a plain element the test appends to the document, handed
 * in as the ref the control takes; `stubScrollMetrics` gives it the writable
 * `scrollTop` jsdom lacks, and `stubScrollTo` gives every element the
 * `scrollTo` jsdom has on none, recording who was asked for what. Nothing
 * here reaches for the control's state or its listener's handle: what it
 * knows is read off the screen, and what it does off the stubs.
 */
stubScrollMetrics(6390);

const THRESHOLD = 420;

/** The one thing on screen when the body is past the line, or `null`. */
const fab = () => screen.queryByRole('button', { name: 'Back to top' });

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

/** What a parent does with a wheel: the container moves, and it says so. */
function scrollTo(top: number) {
  container.scrollTop = top;
  fireEvent.scroll(container);
}

function renderControl(onRender?: () => void) {
  // The one place in `components/` where a prop is a ref rather than a value.
  const ref: BackToTopProps['container'] = { current: container };
  const control = <BackToTop container={ref} />;

  return render(
    <ThemeProvider theme={theme}>
      {onRender ? (
        <Profiler id="back-to-top" onRender={onRender}>
          {control}
        </Profiler>
      ) : (
        control
      )}
    </ThemeProvider>
  );
}

describe('BackToTop — the Scroll threshold', () => {
  it('renders nothing while the container is at its top', () => {
    renderControl();

    expect(fab()).toBeNull();
  });

  it('shows the button named Back to top once the container scrolls past 420', () => {
    renderControl();

    scrollTo(THRESHOLD + 1);

    expect(fab()).not.toBeNull();
  });

  it('shows nothing at exactly 420 — the comparison is strict', () => {
    renderControl();

    scrollTo(THRESHOLD);

    expect(fab()).toBeNull();
  });

  it('takes the button away again when the container comes back under the line', () => {
    renderControl();

    scrollTo(1240);
    expect(fab()).not.toBeNull();

    scrollTo(THRESHOLD);

    expect(fab()).toBeNull();
  });

  it('is already there on attach when the container was past the line before it mounted — the Back case', () => {
    // `useRestoredScroll` puts a revisited home back to its place before the
    // family touches anything; no `scroll` event is fired here on purpose.
    container.scrollTop = 1240;

    renderControl();

    expect(fab()).not.toBeNull();
  });
});

describe('BackToTop — the press', () => {
  const scrolling = stubScrollTo();

  it('asks the container for the top, smoothly, and nothing on window or document', () => {
    const windowScrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    renderControl();
    scrollTo(1240);

    fireEvent.click(fab() as HTMLElement);

    // One request, and it was the container's — not the document element's,
    // not the body's.
    expect(scrolling.requests()).toEqual([
      { element: container, options: { top: 0, behavior: 'smooth' } },
    ]);
    expect(windowScrollTo).not.toHaveBeenCalled();
  });
});

describe('BackToTop — the listener', () => {
  it('registers its scroll listener passive', () => {
    const addEventListener = vi.spyOn(container, 'addEventListener');

    renderControl();

    const scrollRegistrations = addEventListener.mock.calls.filter(
      ([type]) => type === 'scroll'
    );
    expect(scrollRegistrations).toHaveLength(1);
    expect(scrollRegistrations[0][2]).toEqual(
      expect.objectContaining({ passive: true })
    );
  });

  it('lets go of the container on unmount: a scroll fired afterwards changes nothing', () => {
    const removeEventListener = vi.spyOn(container, 'removeEventListener');
    const { unmount } = renderControl();
    scrollTo(1240);
    expect(fab()).not.toBeNull();

    unmount();
    scrollTo(0);
    scrollTo(1240);

    expect(fab()).toBeNull();
    expect(
      removeEventListener.mock.calls.some(([type]) => type === 'scroll')
    ).toBe(true);
  });

  it('writes its state only when the answer changes: scrolls on the same side of the line do not re-render it', () => {
    const onRender = vi.fn();
    renderControl(onRender);

    scrollTo(1240);
    expect(fab()).not.toBeNull();
    const commitsAfterCrossing = onRender.mock.calls.length;

    scrollTo(1300);
    scrollTo(2600);
    scrollTo(4000);

    expect(fab()).not.toBeNull();
    expect(onRender).toHaveBeenCalledTimes(commitsAfterCrossing);
  });
});

describe('BackToTop — keyboard and assistive technology', () => {
  it('is reachable by Tab while on screen', async () => {
    const user = userEvent.setup();
    renderControl();
    scrollTo(1240);

    await user.tab();

    expect(document.activeElement).toBe(fab());
  });

  it('keeps the glyph decorative: the name is Back to top, the arrow is not a second one', () => {
    renderControl();
    scrollTo(1240);

    const glyph = (fab() as HTMLElement).querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    expect(glyph?.getAttribute('role')).toBeNull();
  });
});
