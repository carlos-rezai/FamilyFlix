import { describe, it, expect, afterEach } from 'vitest';

import { comesBefore } from './comesBefore';

function build(html: string) {
  document.body.innerHTML = html;
  return (id: string) => {
    const found = document.getElementById(id);
    if (!found) {
      throw new Error(`No element with id "${id}"`);
    }
    return found;
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('comesBefore', () => {
  it('is true for a sibling that precedes the other', () => {
    const at = build('<p id="first"></p><p id="second"></p>');

    expect(comesBefore(at('first'), at('second'))).toBe(true);
  });

  it('is false the other way round', () => {
    const at = build('<p id="first"></p><p id="second"></p>');

    expect(comesBefore(at('second'), at('first'))).toBe(false);
  });

  it('reads across nesting, not just among siblings', () => {
    // A header slot's contents are nested; the question is still which side of
    // the spacer they landed on.
    const at = build(
      '<div id="start"><span id="inner"></span></div><div id="spacer"></div>'
    );

    expect(comesBefore(at('inner'), at('spacer'))).toBe(true);
    expect(comesBefore(at('spacer'), at('inner'))).toBe(false);
  });

  it('is false for an element compared with itself', () => {
    const at = build('<p id="only"></p>');

    expect(comesBefore(at('only'), at('only'))).toBe(false);
  });

  it('says an ancestor comes before its own descendant', () => {
    const at = build('<div id="outer"><span id="inner"></span></div>');

    expect(comesBefore(at('outer'), at('inner'))).toBe(true);
  });
});
