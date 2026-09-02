import { beforeEach, afterEach } from 'vitest';

/** Every media property the player drives, and the ones jsdom leaves inert. */
const STUBBED = [
  'play',
  'pause',
  'currentTime',
  'duration',
  'paused',
  'readyState',
] as const;

type StubbedProperty = (typeof STUBBED)[number];

/** How the browser answers a `play()` the page made on its own. */
export interface StubMediaOptions {
  /**
   * `'refused'` models an autoplay policy: the first `play()` an element gets —
   * the one the page made by itself — is rejected, and every later one is
   * allowed. Modelling it as "every play fails" would make the big-play circle
   * untestable, since its whole claim is that one press starts the film.
   */
  autoplay?: 'allowed' | 'refused';
}

/** What one stubbed element remembers, since a prototype cannot remember it. */
interface MediaState {
  paused: boolean;
  currentTime: number;
  readyState: number;
  /** Whether this element has already been asked to play once. */
  played: boolean;
}

/**
 * jsdom does no media. `play()` is a not-implemented stub that returns nothing
 * at all — not even a promise, which is the shape an autoplay refusal has to
 * arrive in — and `paused` never moves off `true` however the element is
 * driven. A hook binding element state to React state therefore cannot be
 * observed at all, which is the whole of what `usePlayback` is.
 *
 * Call this inside the `describe` that needs it, and every `<video>` created for
 * the length of that block plays, pauses, remembers a position, and fires the
 * events a hook is listening for.
 *
 * It follows `stubScrollMetrics` in shape, with one difference forced by the
 * DOM: jsdom defines all six of these on `HTMLMediaElement.prototype` itself,
 * so cleanup **restores** the original descriptors rather than deleting them. A
 * `delete` would take jsdom's own implementations with it and leave every later
 * file in the worker without a media element at all.
 */
export function stubMediaElement({
  autoplay = 'allowed',
}: StubMediaOptions = {}) {
  const states = new WeakMap<HTMLMediaElement, MediaState>();

  /** This element's state, created on first touch — elements arrive stopped. */
  function stateOf(element: HTMLMediaElement): MediaState {
    let state = states.get(element);
    if (!state) {
      state = { paused: true, currentTime: 0, readyState: 0, played: false };
      states.set(element, state);
    }
    return state;
  }

  const originals = new Map<StubbedProperty, PropertyDescriptor | undefined>();

  beforeEach(() => {
    for (const property of STUBBED) {
      originals.set(
        property,
        Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, property)
      );
    }

    Object.defineProperties(HTMLMediaElement.prototype, {
      play: {
        configurable: true,
        writable: true,
        value: function play(this: HTMLMediaElement): Promise<void> {
          const state = stateOf(this);
          const refused = autoplay === 'refused' && !state.played;
          state.played = true;

          if (refused) {
            return Promise.reject(
              new DOMException(
                'play() failed because the user did not interact with the document first',
                'NotAllowedError'
              )
            );
          }

          state.paused = false;
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        },
      },
      pause: {
        configurable: true,
        writable: true,
        value: function pause(this: HTMLMediaElement): void {
          stateOf(this).paused = true;
          this.dispatchEvent(new Event('pause'));
        },
      },
      paused: {
        configurable: true,
        get(this: HTMLMediaElement) {
          return stateOf(this).paused;
        },
      },
      currentTime: {
        configurable: true,
        get(this: HTMLMediaElement) {
          return stateOf(this).currentTime;
        },
        set(this: HTMLMediaElement, seconds: number) {
          stateOf(this).currentTime = seconds;
        },
      },
      readyState: {
        configurable: true,
        get(this: HTMLMediaElement) {
          return stateOf(this).readyState;
        },
        set(this: HTMLMediaElement, value: number) {
          stateOf(this).readyState = value;
        },
      },
      duration: {
        configurable: true,
        // Unknown, and deliberately unwritable: it is the truth for a stream,
        // and it is the reason nothing in the player is allowed to ask. A
        // duration comes from the playback read.
        get: () => Number.NaN,
      },
    });
  });

  afterEach(() => {
    for (const property of STUBBED) {
      const original = originals.get(property);
      if (original) {
        Object.defineProperty(HTMLMediaElement.prototype, property, original);
      } else {
        delete (
          HTMLMediaElement.prototype as Partial<
            Record<StubbedProperty, unknown>
          >
        )[property];
      }
    }
  });
}
