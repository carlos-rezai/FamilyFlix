import { beforeEach, afterEach } from 'vitest';

/** One file the page handed to the browser to save. */
export interface Download {
  /** The bytes, as the blob the object URL was minted for. */
  blob: Blob;
  /** The object URL the anchor pointed at. */
  url: string;
  /** The anchor's `download` attribute — the name the file lands under. */
  filename: string;
}

/** What `saveToComputer` asks of the browser, and what jsdom leaves out. */
const STUBBED_URL = ['createObjectURL', 'revokeObjectURL'] as const;

type StubbedUrlProperty = (typeof STUBBED_URL)[number];

/**
 * jsdom has no object URLs — `URL.createObjectURL` and `URL.revokeObjectURL`
 * are not its own, and the Node ones underneath refuse a jsdom blob — and an
 * anchor's `click()` is a "navigation not implemented" error on the console.
 * A unit that hands a blob to the browser through an anchor carrying
 * `download` therefore cannot be observed at all, and would throw before it
 * was.
 *
 * Call this inside the `describe` that needs it, and for the length of that
 * block a blob can be minted an object URL, a press on an anchor pointing at
 * one is recorded as a **download** under the anchor's `download` name, and a
 * revoked URL is remembered as such. `downloads()` is what the page handed the
 * browser so far, in order; `revoked(url)` whether it tidied up after.
 *
 * It follows `stubFullscreen` in shape. Cleanup restores whatever descriptor
 * it found — under Vitest that is Node's own `createObjectURL`, which cannot
 * take a jsdom blob — or deletes what was absent, and the anchor's `click`
 * goes back to the prototype's own. Leaving the stub behind would hand every
 * later file in the worker a browser that saves files silently.
 */
export function stubDownload() {
  const minted = new Map<string, Blob>();
  const revokedUrls = new Set<string>();
  const saved: Download[] = [];
  let next = 0;

  const urlOriginals = new Map<
    StubbedUrlProperty,
    PropertyDescriptor | undefined
  >();
  let clickOriginal: PropertyDescriptor | undefined;

  beforeEach(() => {
    minted.clear();
    revokedUrls.clear();
    saved.splice(0);
    next = 0;

    for (const property of STUBBED_URL) {
      urlOriginals.set(
        property,
        Object.getOwnPropertyDescriptor(URL, property)
      );
    }
    clickOriginal = Object.getOwnPropertyDescriptor(
      HTMLAnchorElement.prototype,
      'click'
    );

    Object.defineProperties(URL, {
      createObjectURL: {
        configurable: true,
        writable: true,
        value: (blob: Blob): string => {
          next += 1;
          const url = `blob:familyflix/${next}`;
          minted.set(url, blob);
          return url;
        },
      },
      revokeObjectURL: {
        configurable: true,
        writable: true,
        value: (url: string): void => {
          revokedUrls.add(url);
        },
      },
    });

    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      writable: true,
      value: function click(this: HTMLAnchorElement): void {
        const url = this.getAttribute('href') ?? '';
        const blob = minted.get(url);
        if (blob === undefined) {
          // A press on an anchor pointing anywhere else is a navigation, which
          // jsdom does not do and which no download ever is.
          return;
        }
        saved.push({ blob, url, filename: this.download });
      },
    });
  });

  afterEach(() => {
    for (const property of STUBBED_URL) {
      const original = urlOriginals.get(property);
      if (original) {
        Object.defineProperty(URL, property, original);
      } else {
        delete (URL as Partial<Record<StubbedUrlProperty, unknown>>)[property];
      }
    }
    if (clickOriginal) {
      Object.defineProperty(
        HTMLAnchorElement.prototype,
        'click',
        clickOriginal
      );
    } else {
      delete (HTMLAnchorElement.prototype as Partial<{ click: unknown }>).click;
    }
  });

  return {
    /** Every file the page handed the browser so far, in order. */
    downloads: (): Download[] => [...saved],
    /** Whether the page revoked the object URL once the anchor was pressed. */
    revoked: (url: string): boolean => revokedUrls.has(url),
    /** Every object URL minted so far, whether or not an anchor was pressed on it. */
    mintedUrls: (): string[] => [...minted.keys()],
  };
}
