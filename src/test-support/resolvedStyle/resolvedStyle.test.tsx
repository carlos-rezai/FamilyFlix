import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { normCss, resolvedStyle } from './resolvedStyle';

/** A stylesheet of our own, so the cascade under test is the one written here. */
function withSheet(css: string, disabled = false) {
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
  render(
    <button type="button" className="a b" disabled={disabled}>
      x
    </button>
  );
  return screen.getByRole('button');
}

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('style').forEach((tag) => tag.remove());
});

describe('resolvedStyle', () => {
  it('lets the later of two equally specific rules win', () => {
    const button = withSheet('.a{color:red}.b{color:blue}');

    expect(resolvedStyle(button).color).toBe('blue');
  });

  it('lets the more specific rule win whatever its order', () => {
    const button = withSheet('.a.b{color:red}.b{color:blue}');

    expect(resolvedStyle(button).color).toBe('red');
  });

  it('applies a state rule only in that state', () => {
    const button = withSheet('.a{color:red}.a:hover:enabled{color:blue}');

    expect(resolvedStyle(button).color).toBe('red');
    expect(resolvedStyle(button, { hover: true }).color).toBe('blue');
  });

  it('reads :not(:disabled) and :enabled off the element itself', () => {
    const button = withSheet(
      '.a{color:red}.a:active:not(:disabled){color:blue}',
      true
    );

    expect(resolvedStyle(button, { active: true }).color).toBe('red');
  });

  it('never applies a rule inside an at-rule, or one about an ancestor it does not have', () => {
    const button = withSheet(
      '.a{color:red}@media (x){.a{color:blue}}.a .b{color:green}'
    );

    expect(resolvedStyle(button).color).toBe('red');
  });

  it('applies a :focus rule under a click’s focus and under the keyboard’s', () => {
    const button = withSheet('.a{color:red}.a:focus{color:blue}');

    expect(resolvedStyle(button, { focus: true }).color).toBe('blue');
    expect(resolvedStyle(button, { focusVisible: true }).color).toBe('blue');
  });

  it('applies a :focus-visible rule under the keyboard’s focus only, never a click’s', () => {
    const button = withSheet('.a{color:red}.a:focus-visible{color:blue}');

    expect(resolvedStyle(button, { focus: true }).color).toBe('red');
    expect(resolvedStyle(button, { focusVisible: true }).color).toBe('blue');
  });

  describe('a selector with a combinator', () => {
    /** The button inside a `.row`, beside a `.label` — ancestor and sibling. */
    function nested(css: string) {
      const tag = document.createElement('style');
      tag.textContent = css;
      document.head.appendChild(tag);
      render(
        <div className="row">
          <span className="label">l</span>
          <button type="button" className="a">
            x
          </button>
        </div>
      );
      return screen.getByRole('button');
    }

    it('applies when the part before the last compound matches the ancestors', () => {
      const button = nested('.a{color:red}.row .a{color:blue}');

      expect(resolvedStyle(button).color).toBe('blue');
    });

    it('adds the ancestor’s weight to the rule’s, so it out-ranks the bare class', () => {
      const button = nested('.row .a{color:blue}.a{color:red}');

      expect(resolvedStyle(button).color).toBe('blue');
    });

    it('reads a sibling combinator the same way', () => {
      const button = nested('.a{color:red}.label+.a{color:blue}');

      expect(resolvedStyle(button).color).toBe('blue');
    });

    it('does not apply when the ancestor is absent', () => {
      const button = nested('.a{color:red}.grid .a{color:blue}');

      expect(resolvedStyle(button).color).toBe('red');
    });

    it('does not apply when the ancestor carries a state, which is not modelled', () => {
      const button = nested('.a{color:red}.row:hover .a{color:blue}');

      expect(resolvedStyle(button, { hover: true }).color).toBe('red');
    });

    it('still asks the last compound for its state', () => {
      const button = nested('.a{color:red}.row .a:hover{color:blue}');

      expect(resolvedStyle(button).color).toBe('red');
      expect(resolvedStyle(button, { hover: true }).color).toBe('blue');
    });
  });

  it('puts !important ahead of specificity', () => {
    const button = withSheet('.a{color:red!important}.a.b{color:blue}');

    expect(resolvedStyle(button).color).toBe('red');
  });

  it('compares values with their whitespace and leading zeros aside', () => {
    expect(normCss('translateY(-50%) scale(0.94)')).toBe(
      normCss('translateY(-50%)  scale(.94)')
    );
  });
});
