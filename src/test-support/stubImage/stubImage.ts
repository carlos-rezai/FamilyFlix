import { act } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/** One `Image` the code under test made, and the `decode()` it is waiting on. */
interface HeldImage {
  src: string;
  decodes: number;
  settle: ((outcome: 'decoded' | 'failed') => void) | null;
}

/**
 * jsdom's `HTMLImageElement` loads nothing and has no `decode()`, so a
 * **Warm start** cannot be observed against it: every picture would either
 * never decode or fail at once. This stands in for the global `Image` the way
 * a browser answers it, except that no `decode()` settles until the test says
 * so, which is what lets a suite see the page before and after a picture is
 * decoded, and on a failure.
 *
 * `stubLocation`'s shape: call it inside the `describe` (or at the top of the
 * file) that needs it, and for the length of that block `Image` is the stub.
 * The code under test reaches it as the global `Image`, so `new Image()`,
 * then `src`, then `decode()`.
 */
export function stubImage() {
  let images: HeldImage[] = [];

  beforeEach(() => {
    images = [];
    vi.stubGlobal(
      'Image',
      class {
        private readonly held: HeldImage = {
          src: '',
          decodes: 0,
          settle: null,
        };

        constructor() {
          images.push(this.held);
        }

        get src() {
          return this.held.src;
        }

        set src(value: string) {
          this.held.src = value;
        }

        decode(): Promise<void> {
          this.held.decodes += 1;
          return new Promise<void>((resolve, reject) => {
            this.held.settle = (outcome) => {
              this.held.settle = null;
              if (outcome === 'decoded') {
                resolve();
              } else {
                reject(new Error(`EncodingError: ${this.held.src}`));
              }
            };
          });
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The latest image of `src` still waiting on its `decode()`. */
  function pending(src: string): HeldImage {
    const image = [...images]
      .reverse()
      .find((each) => each.src === src && each.settle !== null);
    if (image === undefined) {
      throw new Error(`no image of ${src} is waiting on its decode()`);
    }
    return image;
  }

  async function settle(src: string, outcome: 'decoded' | 'failed') {
    const image = pending(src);
    await act(async () => {
      image.settle?.(outcome);
      // A macrotask, so every promise chained on the decode has run.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return {
    /** How many images were made of `src`: the times it was asked for. */
    created(src: string): number {
      return images.filter((each) => each.src === src).length;
    },
    /** How many `decode()` calls were made on images of `src`. */
    decodes(src: string): number {
      return images
        .filter((each) => each.src === src)
        .reduce((sum, each) => sum + each.decodes, 0);
    },
    /** Every src asked for, in order. */
    sources(): string[] {
      return images.map((each) => each.src);
    },
    /** Decode the latest waiting image of `src`, as the browser would. */
    decode(src: string): Promise<void> {
      return settle(src, 'decoded');
    },
    /** Fail the latest waiting image of `src`: a missing or broken file. */
    fail(src: string): Promise<void> {
      return settle(src, 'failed');
    },
  };
}
