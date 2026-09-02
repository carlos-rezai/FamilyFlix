import { beforeEach, afterEach } from 'vitest';

/** What the player asks of the document, and what jsdom leaves out. */
const STUBBED_DOCUMENT = [
  'fullscreenElement',
  'fullscreenEnabled',
  'exitFullscreen',
] as const;

/** What it asks of the element it wants filling the screen. */
const STUBBED_ELEMENT = ['requestFullscreen'] as const;

type StubbedDocumentProperty = (typeof STUBBED_DOCUMENT)[number];
type StubbedElementProperty = (typeof STUBBED_ELEMENT)[number];

/** How the browser answers a request to fill the screen. */
export interface StubFullscreenOptions {
  /**
   * `'refused'` models a browser that will not grant it — a request made
   * outside a gesture, a kiosk policy, an embedded frame without the
   * permission. The promise rejects and nothing enters fullscreen, which is
   * the state the player has to survive rather than throw on.
   */
  request?: 'allowed' | 'refused';
}

/**
 * jsdom has no Fullscreen API whatsoever: no `requestFullscreen` on an element,
 * no `exitFullscreen` on the document, no `fullscreenElement` to read and no
 * `fullscreenchange` to fire. Not one of them is merely inert — they are
 * absent, so a hook that drives them cannot be observed at all, and a hook
 * written against them would not even run.
 *
 * Call this inside the `describe` that needs it, and for the length of that
 * block an element can be asked to fill the screen, the document remembers
 * which one has, leaving it puts it back, and both transitions announce
 * themselves through `fullscreenchange` the way a browser announces them.
 *
 * It follows `stubMediaElement` in shape, with one difference forced by the
 * DOM: because jsdom defines none of these, cleanup **deletes** them rather
 * than restoring a descriptor. Leaving them behind would hand every later file
 * in the worker a browser that supports fullscreen, which is the opposite of
 * the one the player actually has to cope with.
 *
 * The event is fired at the document rather than at the element. A real browser
 * fires it at the element and lets it bubble, but an element a test has not put
 * in the document would then announce nothing, and the transition is the thing
 * being modelled — not the DOM tree the test happened to build.
 */
export function stubFullscreen({
  request = 'allowed',
}: StubFullscreenOptions = {}) {
  /** Which element is filling the screen — the document's own truth. */
  let current: Element | null = null;

  function announce(): void {
    document.dispatchEvent(new Event('fullscreenchange'));
  }

  /** An element takes the screen, and the document says so. */
  function enter(element: Element): void {
    current = element;
    announce();
  }

  const documentOriginals = new Map<
    StubbedDocumentProperty,
    PropertyDescriptor | undefined
  >();
  const elementOriginals = new Map<
    StubbedElementProperty,
    PropertyDescriptor | undefined
  >();

  beforeEach(() => {
    current = null;

    for (const property of STUBBED_DOCUMENT) {
      documentOriginals.set(
        property,
        Object.getOwnPropertyDescriptor(Document.prototype, property)
      );
    }
    for (const property of STUBBED_ELEMENT) {
      elementOriginals.set(
        property,
        Object.getOwnPropertyDescriptor(Element.prototype, property)
      );
    }

    Object.defineProperties(Element.prototype, {
      requestFullscreen: {
        configurable: true,
        writable: true,
        value: function requestFullscreen(this: Element): Promise<void> {
          if (request === 'refused') {
            return Promise.reject(
              new TypeError('Permissions check failed for fullscreen')
            );
          }
          enter(this);
          return Promise.resolve();
        },
      },
    });

    Object.defineProperties(Document.prototype, {
      fullscreenElement: {
        configurable: true,
        get: () => current,
      },
      fullscreenEnabled: {
        configurable: true,
        get: () => true,
      },
      exitFullscreen: {
        configurable: true,
        writable: true,
        value: function exitFullscreen(): Promise<void> {
          // Leaving when nothing is filling the screen is a rejection in a real
          // browser, not a silent no-op, and a player that called it blindly
          // would log an unhandled rejection on every press.
          if (current === null) {
            return Promise.reject(
              new TypeError('Document not active for fullscreen')
            );
          }
          current = null;
          announce();
          return Promise.resolve();
        },
      },
    });
  });

  afterEach(() => {
    for (const property of STUBBED_DOCUMENT) {
      const original = documentOriginals.get(property);
      if (original) {
        Object.defineProperty(Document.prototype, property, original);
      } else {
        delete (
          Document.prototype as Partial<
            Record<StubbedDocumentProperty, unknown>
          >
        )[property];
      }
    }
    for (const property of STUBBED_ELEMENT) {
      const original = elementOriginals.get(property);
      if (original) {
        Object.defineProperty(Element.prototype, property, original);
      } else {
        delete (
          Element.prototype as Partial<Record<StubbedElementProperty, unknown>>
        )[property];
      }
    }
    current = null;
  });
}
