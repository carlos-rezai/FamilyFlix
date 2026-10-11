import { describe, it, expect } from 'vitest';

import { stubLocation } from './stubLocation';

/**
 * 37 — Factory reset, the surface (issue #299).
 *
 * jsdom has no navigation, and its `location.assign` cannot be spied — so the
 * reload onto `/` that ends a **Factory reset** could not be observed. This is
 * scaffolding, and the claims below are the ones `useFactoryReset`'s leaves
 * lean on: an `assign` is recorded with its URL and goes nowhere, nothing
 * asked is nothing, the rest of `location` reads as it did — and a `window`
 * left exactly as it was found once the installing block is over.
 */
describe('stubLocation — inside the block that installed it', () => {
  const location = stubLocation();

  it('records an assign with its URL, in order', () => {
    window.location.assign('/');
    window.location.assign('/settings');

    expect(location.assigned()).toEqual(['/', '/settings']);
  });

  it('goes nowhere on an assign', () => {
    const before = window.location.href;

    window.location.assign('/elsewhere');

    expect(window.location.href).toBe(before);
  });

  it('starts every leaf with nothing recorded', () => {
    expect(location.assigned()).toEqual([]);
  });

  it('reads the rest of location as the real one does', () => {
    expect(window.location.pathname).toBe(
      new URL(window.location.href).pathname
    );
    expect(typeof window.location.replace).toBe('function');
  });
});

describe('stubLocation — after the block that installed it', () => {
  it('leaves the real location behind', () => {
    const own = Object.getOwnPropertyDescriptor(window.location, 'assign');

    expect(own?.writable).toBe(false);
  });
});
