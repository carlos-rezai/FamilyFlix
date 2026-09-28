import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { ScopeCard, type ScopeCardProps } from './ScopeCard';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: `ScopeCard` is its own unit.
 *
 * One **Enrichment scope** card, 1:1 with the prototype's `scopeCard`: a
 * `role="radio"` button, the dot on the left, the 15px label and the line
 * indented under it — on the surface, or selected on the accent-soft fill
 * inside the accent line.
 */
function renderCard(props: Partial<ScopeCardProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <div role="radiogroup" aria-label="What to sync">
        <ScopeCard
          label="Everything"
          description="30 titles — re-checks ones already filled in"
          selected={false}
          {...props}
        />
      </div>
    </ThemeProvider>
  );
}

const radio = () => screen.getByRole('radio', { name: /Everything/ });
const style = (element: Element, property: string) =>
  normCss(resolvedStyle(element)[property] ?? '');
const dot = () => {
  const found = radio().querySelector('[aria-hidden="true"]');
  if (!found) throw new Error('no dot');
  return found;
};

describe('ScopeCard — what it is', () => {
  it('is a button radio named by its label and line', () => {
    renderCard();

    expect(radio().tagName).toBe('BUTTON');
    expect(radio().getAttribute('type')).toBe('button');
    expect(
      screen.getByText('30 titles — re-checks ones already filled in')
    ).toBeDefined();
  });

  it('is checked only when selected', () => {
    renderCard({ selected: true });
    expect(radio().getAttribute('aria-checked')).toBe('true');
  });

  it('is unchecked when not selected', () => {
    renderCard();
    expect(radio().getAttribute('aria-checked')).toBe('false');
  });

  it('calls onSelect on press', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.click(radio());

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('presses harmlessly with nothing to choose', () => {
    renderCard({ selected: true, onSelect: undefined });

    expect(() => fireEvent.click(radio())).not.toThrow();
  });
});

describe('ScopeCard — its faces', () => {
  it('sits on the surface inside the soft border when not selected', () => {
    renderCard();

    expect(style(radio(), 'background')).toBe(normCss(theme.colors.surface));
    expect(style(radio(), 'border')).toBe(
      normCss(`1px solid ${theme.colors.borderSoft}`)
    );
  });

  it('sits on the accent-soft fill inside the accent line when selected', () => {
    renderCard({ selected: true });

    expect(style(radio(), 'background')).toBe(normCss(theme.colors.accentSoft));
    expect(style(radio(), 'border')).toBe(
      normCss(`1px solid ${theme.colors.accentLine}`)
    );
  });
});

describe('ScopeCard — the dot, the label, the line', () => {
  it('draws the dot first, ahead of the label', () => {
    renderCard();

    expect(radio().firstElementChild?.firstElementChild).toBe(dot());
  });

  it('fills the dot in the accent when selected', () => {
    renderCard({ selected: true });

    expect(style(dot(), 'background')).toBe(normCss(theme.colors.accent));
    expect(style(dot(), 'border')).toBe(
      normCss(`2px solid ${theme.colors.accent}`)
    );
  });

  it('draws an empty ring when not selected', () => {
    renderCard();

    expect(style(dot(), 'background')).toBe('transparent');
    expect(style(dot(), 'border')).toBe(
      normCss(`2px solid ${theme.colors.textFaint}`)
    );
  });

  it('sets the label at 15px and indents the line 28px', () => {
    renderCard();

    expect(style(screen.getByText('Everything'), 'font-size')).toBe('15px');
    expect(
      style(
        screen.getByText('30 titles — re-checks ones already filled in'),
        'margin'
      )
    ).toBe('6px 0 0 28px');
  });
});
