import { describe, it, expect, afterEach } from 'vitest';

import { snackbarStack } from './snackbarStack';

function build(html: string) {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('snackbarStack', () => {
  it('finds the fixed, reversed column', () => {
    build(
      '<div id="page"></div>' +
        '<div id="stack" style="position: fixed; display: flex; flex-direction: column-reverse"></div>'
    );

    expect(snackbarStack().id).toBe('stack');
  });

  it('throws, naming itself, when the document has none', () => {
    build('<div id="page"></div>');

    expect(() => snackbarStack()).toThrow(/^snackbarStack:/);
  });

  it('passes over a fixed column that is not reversed', () => {
    build(
      '<div id="header" style="position: fixed; display: flex; flex-direction: column"></div>'
    );

    expect(() => snackbarStack()).toThrow(/^snackbarStack:/);
  });
});
