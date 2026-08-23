import { describe, it, expect } from 'vitest';

import { stubScrollMetrics } from './stubScrollMetrics';

/**
 * The helper is scaffolding for other suites, so the claims here are the ones
 * those suites lean on: an element that can be scrolled, an element that looks
 * genuinely overflowing, and — the reason this is shared at all — a prototype
 * left exactly as it was found once the installing block is over.
 */
describe('stubScrollMetrics — inside the block that installed it', () => {
  stubScrollMetrics(9400);

  it('reports the content height it was given', () => {
    const element = document.createElement('div');

    expect(element.scrollHeight).toBe(9400);
  });

  it('reports a viewport shorter than that content, so there is room to scroll', () => {
    const element = document.createElement('div');

    expect(element.clientHeight).toBeGreaterThan(0);
    expect(element.clientHeight).toBeLessThan(element.scrollHeight);
  });

  it('starts an element that has never been scrolled at the top', () => {
    const element = document.createElement('div');

    expect(element.scrollTop).toBe(0);
  });

  it('remembers a scroll position written to an element', () => {
    const element = document.createElement('div');

    element.scrollTop = 1840;

    expect(element.scrollTop).toBe(1840);
  });

  it('keeps every element at its own scroll position', () => {
    const shelf = document.createElement('div');
    const page = document.createElement('div');

    shelf.scrollTop = 1840;
    page.scrollTop = 320;

    expect(shelf.scrollTop).toBe(1840);
    expect(page.scrollTop).toBe(320);
  });
});

describe('stubScrollMetrics — a second block, stubbing a different screen', () => {
  stubScrollMetrics(4200);

  it('reports the content height that block asked for, not the other one', () => {
    const element = document.createElement('div');

    expect(element.scrollHeight).toBe(4200);
  });
});

describe('stubScrollMetrics — after those blocks have finished', () => {
  it('has handed scroll metrics back to jsdom, which does no layout', () => {
    const element = document.createElement('div');

    element.scrollTop = 1840;

    expect(element.scrollTop).toBe(0);
    expect(element.scrollHeight).toBe(0);
  });

  it('leaves nothing of its own shadowing the prototype for the next file', () => {
    for (const property of [
      'scrollTop',
      'scrollHeight',
      'clientHeight',
    ] as const) {
      expect(
        Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)
      ).toBeUndefined();
    }
  });
});
