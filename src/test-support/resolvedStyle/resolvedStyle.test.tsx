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

  it('never applies a rule inside an at-rule, or one about another element', () => {
    const button = withSheet(
      '.a{color:red}@media (x){.a{color:blue}}.a .b{color:green}'
    );

    expect(resolvedStyle(button).color).toBe('red');
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
