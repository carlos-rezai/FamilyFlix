import { afterEach, beforeEach } from 'vitest';

/**
 * jsdom has no navigation: `window.location.assign` is an own, non-writable,
 * non-configurable property — `vi.spyOn` cannot redefine it — and calling it
 * logs _Not implemented: navigation_ and goes nowhere. So a reload onto a
 * **Fresh home** cannot be observed at all.
 *
 * `window.location` itself is configurable, though. Call this inside the
 * `describe` that needs it, and for the length of that block `window.location`
 * is the real one with its `assign` recorded rather than run: every URL asked
 * for, in order, read back by `assigned()`. Everything else — `pathname`,
 * `href`, `replace` — answers as the real one does, so a leaf can tell an
 * `assign` from a `replace` by which one was recorded.
 *
 * `stubScrollTo`'s shape, with the one difference the DOM allows: jsdom does
 * define `location`, so cleanup **restores** the descriptor it found.
 */
export function stubLocation() {
  const asked: string[] = [];
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    asked.splice(0);
    original = Object.getOwnPropertyDescriptor(window, 'location');
    const real = window.location;

    // Over an empty target, read through to the real one: a Proxy over the
    // real `location` may not answer anything but its frozen `assign`.
    const recorded = new Proxy({} as Location, {
      get(_target, property) {
        if (property === 'assign') {
          return (url: string | URL) => {
            asked.push(String(url));
          };
        }
        const value: unknown = Reflect.get(real, property, real);
        return typeof value === 'function' ? value.bind(real) : value;
      },
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => recorded,
    });
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(window, 'location', original);
    }
    asked.splice(0);
  });

  return {
    /** Every URL `location.assign` was asked for so far, in order. */
    assigned: (): string[] => [...asked],
  };
}
