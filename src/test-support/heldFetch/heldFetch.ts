import { act } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/**
 * Answers a request at once with a response, or `undefined` to hold it: the
 * reads a screen makes on mount, so only the action under test is held.
 */
export type PassFn = (url: string, init?: RequestInit) => Response | undefined;

/**
 * A `fetch` that holds every request open until the test answers it: the
 * busy suites' way to keep an action in flight while the clock walks the
 * **Loader timing**. A request `pass` answers is answered at once; every other
 * stays open until `respond(response)` answers the latest one held.
 *
 * `stubLocation`'s shape: call it inside the `describe` (or at the top of the
 * file) that needs it, and for the length of that block `fetch` is the mock.
 * Cleanup restores the `fetch` it found, and nothing else.
 */
export function heldFetch(pass: PassFn = () => undefined) {
  const fetchMock = vi.fn<FetchFn>();
  let answer: (response: Response) => void = () => undefined;
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    answer = () => undefined;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const passed = pass(String(input), init);
      if (passed !== undefined) {
        return Promise.resolve(passed);
      }
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    });
    original = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, 'fetch', original);
    }
    answer = () => undefined;
  });

  return {
    /** The stubbed `fetch`, to read its calls from. */
    fetchMock,
    /** Answers the latest held request with `response`, under `act`. */
    respond: async (response: Response): Promise<void> => {
      await act(async () => {
        answer(response);
      });
    },
  };
}
