import { describe, it, expect, afterEach } from 'vitest';

import { paintedBackgrounds } from './paintedBackgrounds';

function build(html: string): Element {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  if (!root) {
    throw new Error('Nothing built');
  }
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('paintedBackgrounds', () => {
  it('answers one line for a root with no children', () => {
    const root = build('<div style="background-color: rgb(1, 2, 3)"></div>');

    const painted = paintedBackgrounds(root);

    expect(painted).toHaveLength(1);
    expect(painted[0]).toContain('rgb(1, 2, 3)');
  });

  it('reads a child’s background image', () => {
    const root = build(
      '<div><span style="background-image: url(/art.jpg)"></span></div>'
    );

    expect(paintedBackgrounds(root).join('\n')).toContain('/art.jpg');
  });

  it('keeps document order, the root first', () => {
    const root = build(
      '<div style="background-color: rgb(1, 1, 1)">' +
        '<p style="background-color: rgb(2, 2, 2)">' +
        '<span style="background-color: rgb(3, 3, 3)"></span></p>' +
        '<p style="background-color: rgb(4, 4, 4)"></p></div>'
    );

    const painted = paintedBackgrounds(root);

    expect(painted).toHaveLength(4);
    ['rgb(1, 1, 1)', 'rgb(2, 2, 2)', 'rgb(3, 3, 3)', 'rgb(4, 4, 4)'].forEach(
      (colour, i) => expect(painted[i]).toContain(colour)
    );
  });
});
