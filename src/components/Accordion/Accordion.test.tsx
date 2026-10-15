import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import type { ReactNode } from 'react';

import { Accordion, type AccordionProps } from './Accordion';
import { Accordion as FromBarrel } from '@/components';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 42 — Review at scale (issue #358): the **Accordion**, `mol.Accordion` 1:1.
 *
 * A header over a body. The header row is the toggle — one button holding the
 * chevron, the label, the caller's `marks` and the `count` pill — then the
 * caller's `actions` beside it, never inside it, so a button never nests in a
 * button. The button carries `aria-expanded` and `aria-controls`; the body is
 * a labelled `region`, **unmounted while closed**. Controlled, `PillTabs`' and
 * `Toggle`'s rule: it holds no open state. A **Control** under
 * `controlStates`. Domain-free.
 */

const c = theme.colors;

function renderAccordion(props: Partial<AccordionProps> = {}) {
  const onToggle = props.onToggle ?? vi.fn();
  const view = (over: Partial<AccordionProps>) => (
    <ThemeProvider theme={theme}>
      <Accordion
        label="The Night Ferry"
        count={3}
        expanded={false}
        onToggle={onToggle}
        {...props}
        {...over}
      >
        {props.children ?? <p>The first row</p>}
      </Accordion>
    </ThemeProvider>
  );
  const rendered = render(view({}));
  return {
    onToggle,
    rerender: (over: Partial<AccordionProps>) => rendered.rerender(view(over)),
  };
}

const toggle = () => screen.getByRole('button', { name: /The Night Ferry/ });

describe('Accordion — the header', () => {
  it('is re-exported from the components barrel', () => {
    expect(FromBarrel).toBe(Accordion);
  });

  it('is one button carrying the label and the count', () => {
    renderAccordion();

    expect(within(toggle()).getByText('The Night Ferry')).toBeDefined();
    expect(within(toggle()).getByText('3')).toBeDefined();
  });

  it('announces itself collapsed while closed and expanded while open', () => {
    const { rerender } = renderAccordion({ expanded: false });
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    rerender({ expanded: true });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('reports a press through onToggle and does not open itself', () => {
    const { onToggle } = renderAccordion({ expanded: false });

    fireEvent.click(toggle());

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('The first row')).toBeNull();
  });

  it('draws the marks inside the button, between the label and the count', () => {
    renderAccordion({ marks: <span data-testid="mark" /> });

    const mark = screen.getByTestId('mark');
    expect(toggle().contains(mark)).toBe(true);
    expect(
      comesBefore(within(toggle()).getByText('The Night Ferry'), mark)
    ).toBe(true);
    expect(comesBefore(mark, within(toggle()).getByText('3'))).toBe(true);
  });

  it('draws the actions beside the button, never inside it', () => {
    const onAction = vi.fn();
    const { onToggle } = renderAccordion({
      actions: <button onClick={onAction}>Skip all</button>,
    });

    const action = screen.getByRole('button', { name: 'Skip all' });
    expect(toggle().contains(action)).toBe(false);
    expect(comesBefore(toggle(), action)).toBe(true);

    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('draws no other button without actions', () => {
    renderAccordion();

    expect(screen.getAllByRole('button')).toEqual([toggle()]);
  });
});

describe('Accordion — the body', () => {
  it('unmounts the body while closed', () => {
    renderAccordion({ expanded: false });

    expect(screen.queryByText('The first row')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('mounts the body while open as a region named by the label', () => {
    renderAccordion({ expanded: true });

    const region = screen.getByRole('region', { name: 'The Night Ferry' });
    expect(within(region).getByText('The first row')).toBeDefined();
  });

  it('points aria-controls at the body it opens', () => {
    renderAccordion({ expanded: true });

    const id = toggle().getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)).toBe(
      screen.getByRole('region', { name: 'The Night Ferry' })
    );
  });

  it('gives two accordions two bodies of their own', () => {
    const body = (label: string): ReactNode => (
      <Accordion label={label} count={2} expanded onToggle={() => undefined}>
        <p>{label} rows</p>
      </Accordion>
    );
    render(
      <ThemeProvider theme={theme}>
        {body('Heat')}
        {body('Ronin')}
      </ThemeProvider>
    );

    const heat = screen.getByRole('button', { name: /Heat/ });
    const ronin = screen.getByRole('button', { name: /Ronin/ });
    expect(heat.getAttribute('aria-controls')).not.toBe(
      ronin.getAttribute('aria-controls')
    );
    expect(
      document.getElementById(ronin.getAttribute('aria-controls') as string)
        ?.textContent
    ).toBe('Ronin rows');
  });
});

describe('Accordion — the Control', () => {
  it('rests on the row card: the surface, the soft hairline, the md radius', () => {
    renderAccordion();

    // The card is the header row's parent, the row the toggle's.
    const card = toggle().parentElement?.parentElement as HTMLElement;
    const style = resolvedStyle(card);
    expect(style.background).toBe(normCss(c.surface));
    expect(style.border).toBe(normCss(`1px solid ${c.borderSoft}`));
    expect(style['border-radius']).toBe(theme.radius.md);
  });

  it('leaves the toggle transparent at rest, 16px in', () => {
    renderAccordion();

    const style = resolvedStyle(toggle());
    expect(style.background).toBe('transparent');
    expect(style.padding).toBe('16px');
    expect(style.cursor).toBe('pointer');
  });

  it('shifts the toggle’s fill to surface-2 on hover', () => {
    renderAccordion();

    expect(resolvedStyle(toggle(), { hover: true }).background).toBe(
      normCss(c.surface2)
    );
  });

  it('darkens to surface-3 and settles to .98 in 60ms on press', () => {
    renderAccordion();

    const pressed = resolvedStyle(toggle(), { hover: true, active: true });
    expect(pressed.background).toBe(normCss(c.surface3));
    expect(pressed.transform).toBe(normCss('scale(.98)'));
    expect(pressed['transition-duration']).toBe('60ms');
  });

  it('draws the accent Focus ring under Tab, and none for a click', () => {
    renderAccordion();

    expect(resolvedStyle(toggle(), { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${c.focusRing}`)
    );
    expect(resolvedStyle(toggle(), { focus: true })).toEqual(
      resolvedStyle(toggle())
    );
  });
});
