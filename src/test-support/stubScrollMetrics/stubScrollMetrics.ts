import { beforeEach, afterEach } from 'vitest';

const SCROLL_METRICS = ['scrollTop', 'scrollHeight', 'clientHeight'] as const;

type ScrollMetric = (typeof SCROLL_METRICS)[number];

/**
 * The viewport every stubbed screen is measured against — the browse home's
 * measured 698 (issue #28). It never varies between suites: what varies is how
 * much content is hanging below it.
 */
const VIEWPORT_HEIGHT = 698;

/**
 * jsdom does no layout: every element reports `scrollHeight: 0` over a
 * `clientHeight: 0`, so nothing ever looks scrollable and a body returning to a
 * position could never be observed at all. Call this inside the `describe` that
 * needs it, passing the content height that screen is pretending to have — the browse home's measured 6390,
 * a 214-card genre shelf's 9400 — and every element gains a real, writable
 * `scrollTop` and a genuine overflow for the length of that block.
 *
 * It registers its own cleanup, because the stub lives on
 * `HTMLElement.prototype`: a leaked one would silently follow whatever file
 * runs next.
 */
export function stubScrollMetrics(scrollHeight: number) {
  const scrollTops = new WeakMap<HTMLElement, number>();

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      get(this: HTMLElement) {
        return scrollTops.get(this) ?? 0;
      },
      set(this: HTMLElement, value: number) {
        scrollTops.set(this, value);
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });
  });

  afterEach(() => {
    // Own properties on HTMLElement.prototype shadowing jsdom's own accessors
    // on Element.prototype — deleting them restores the real ones.
    for (const metric of SCROLL_METRICS) {
      delete (HTMLElement.prototype as Partial<Record<ScrollMetric, number>>)[
        metric
      ];
    }
  });
}
