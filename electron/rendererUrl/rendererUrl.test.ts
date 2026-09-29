// @vitest-environment node
//
// Issue #216 — the window over the server. `rendererUrl` is where the one
// window points: Vite's dev server under `electron:dev`, so HMR works in the
// window, and otherwise the server's own origin on the loopback address it
// bound — **One origin**, so every relative call site stays as it is.

import { describe, expect, it } from 'vitest';

import { rendererUrl } from './rendererUrl';

describe('rendererUrl', () => {
  it('points the dev window at Vite on localhost:4200', () => {
    const url = new URL(rendererUrl(true, 3001));

    expect(url.origin).toBe('http://localhost:4200');
    expect(url.pathname).toBe('/');
  });

  it('points every other window at the server on 127.0.0.1 and its port', () => {
    const url = new URL(rendererUrl(false, 41720));

    expect(url.origin).toBe('http://127.0.0.1:41720');
    expect(url.pathname).toBe('/');
  });

  it('carries whatever port the server reported, not a fixed one', () => {
    expect(new URL(rendererUrl(false, 53117)).origin).toBe(
      'http://127.0.0.1:53117'
    );
  });
});
