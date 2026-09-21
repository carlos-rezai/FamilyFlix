import { beforeEach, afterEach } from 'vitest';

/** One request to put an element at a position. */
export interface ScrollRequest {
  /** The element that was asked. */
  element: Element;
  /** What it was asked for — the options form, the only one the app calls. */
  options: ScrollToOptions;
}

/**
 * jsdom implements `scrollTo` on `window` and on no element:
 * `Element.prototype.scrollTo` is `undefined`, so a control that rides a
 * scrolling container back to its top cannot be observed at all, and would
 * throw before it was.
 *
 * Call this inside the `describe` that needs it, and for the length of that
 * block any element can be asked for a position; every request is recorded as
 * the element asked and the options it was asked for, in order, and
 * `requests()` reads them back — so a leaf can say _one request, and it was
 * the container's_ rather than stub three elements to prove two were left
 * alone. `window.scrollTo` is not its business: jsdom has one, and a leaf that
 * wants to prove the window was left alone spies what exists.
 *
 * It follows `stubFullscreen` in shape, including the one difference the DOM
 * forces: jsdom defines none of this, so cleanup **deletes** rather than
 * restores. Leaving it behind would hand every later file in the worker an
 * element that can scroll, which is the opposite of the one the control has to
 * cope with — and the per-test assignment this replaces did exactly that to
 * `document.documentElement` and `document.body`.
 */
export function stubScrollTo() {
  const asked: ScrollRequest[] = [];
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    asked.splice(0);
    original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo');

    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: function scrollTo(this: Element, options: ScrollToOptions): void {
        asked.push({ element: this, options });
      },
    });
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(Element.prototype, 'scrollTo', original);
    } else {
      delete (Element.prototype as Partial<{ scrollTo: unknown }>).scrollTo;
    }
    asked.splice(0);
  });

  return {
    /** Every request so far, in order: who was asked, and for what. */
    requests: (): ScrollRequest[] => [...asked],
  };
}
