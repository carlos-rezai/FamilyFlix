import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PhaseStepper, type PhaseStepperProps } from './PhaseStepper';
import { theme } from '@/styles/theme';

/**
 * 13 — Bulk import, Phase 3: "the console" (issue #128).
 *
 * The `Connect ✓ → Scan → Import` stepper over the **Running step**, from
 * `feat.ImportFlow.dc.html`: three steps, each a 24px dot and a label. A
 * **done** step is ticked in the `watched` green with its label dimmed; the
 * **active** step shows its number in `accent` with its label in full ink;
 * a **pending** step shows its number on `surface-3` with everything faint.
 * Connect is done the moment the step is drawn — a run that is running has
 * connected — so the phase alone says where the other two are.
 */

function renderStepper(props: Partial<PhaseStepperProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <PhaseStepper phase="scanning" {...props} />
    </ThemeProvider>
  );
}

/** A step is its dot and its label, side by side: the label's parent. */
const step = (label: 'Connect' | 'Scan' | 'Import'): HTMLElement =>
  screen.getByText(label).parentElement as HTMLElement;

/** The dot is what sits before the label. */
const dotOf = (label: 'Connect' | 'Scan' | 'Import'): HTMLElement =>
  screen.getByText(label).previousElementSibling as HTMLElement;

const WATCHED = 'rgb(138, 154, 107)';
const ACCENT = 'rgb(217, 122, 78)';
const SURFACE_3 = 'rgb(51, 42, 32)';
const TEXT = 'rgb(243, 236, 224)';
const TEXT_DIM = 'rgb(182, 169, 148)';
const TEXT_FAINT = 'rgb(133, 122, 104)';

describe('PhaseStepper — the three steps', () => {
  it('names Connect, Scan and Import, in that order', () => {
    renderStepper();

    const labels = ['Connect', 'Scan', 'Import'].map((label) =>
      screen.getByText(label)
    );
    expect(
      labels[0].compareDocumentPosition(labels[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      labels[1].compareDocumentPosition(labels[2]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('PhaseStepper — while scanning', () => {
  it('marks Connect done: ticked in the watched green, label dimmed', () => {
    renderStepper({ phase: 'scanning' });

    expect(within(step('Connect')).getByText('✓')).toBeTruthy();
    expect(getComputedStyle(dotOf('Connect')).backgroundColor).toBe(WATCHED);
    expect(getComputedStyle(screen.getByText('Connect')).color).toBe(TEXT_DIM);
  });

  it('marks Scan active: its number in accent, label in full ink', () => {
    renderStepper({ phase: 'scanning' });

    expect(within(step('Scan')).getByText('2')).toBeTruthy();
    expect(within(step('Scan')).queryByText('✓')).toBeNull();
    expect(getComputedStyle(dotOf('Scan')).backgroundColor).toBe(ACCENT);
    expect(getComputedStyle(screen.getByText('Scan')).color).toBe(TEXT);
  });

  it('marks Import pending: its number on surface-3, everything faint', () => {
    renderStepper({ phase: 'scanning' });

    expect(within(step('Import')).getByText('3')).toBeTruthy();
    expect(getComputedStyle(dotOf('Import')).backgroundColor).toBe(SURFACE_3);
    expect(getComputedStyle(dotOf('Import')).color).toBe(TEXT_FAINT);
    expect(getComputedStyle(screen.getByText('Import')).color).toBe(TEXT_FAINT);
  });

  it('tells assistive tech which step is the current one', () => {
    renderStepper({ phase: 'scanning' });

    expect(step('Scan').getAttribute('aria-current')).toBe('step');
    expect(step('Connect').getAttribute('aria-current')).toBeNull();
    expect(step('Import').getAttribute('aria-current')).toBeNull();
  });
});

describe('PhaseStepper — while importing', () => {
  it('keeps Connect done', () => {
    renderStepper({ phase: 'importing' });

    expect(within(step('Connect')).getByText('✓')).toBeTruthy();
    expect(getComputedStyle(dotOf('Connect')).backgroundColor).toBe(WATCHED);
  });

  it('marks Scan done: ticked in the watched green, label dimmed', () => {
    renderStepper({ phase: 'importing' });

    expect(within(step('Scan')).getByText('✓')).toBeTruthy();
    expect(within(step('Scan')).queryByText('2')).toBeNull();
    expect(getComputedStyle(dotOf('Scan')).backgroundColor).toBe(WATCHED);
    expect(getComputedStyle(screen.getByText('Scan')).color).toBe(TEXT_DIM);
  });

  it('marks Import active: its number in accent, label in full ink', () => {
    renderStepper({ phase: 'importing' });

    expect(within(step('Import')).getByText('3')).toBeTruthy();
    expect(getComputedStyle(dotOf('Import')).backgroundColor).toBe(ACCENT);
    expect(getComputedStyle(screen.getByText('Import')).color).toBe(TEXT);
    expect(step('Import').getAttribute('aria-current')).toBe('step');
    expect(step('Scan').getAttribute('aria-current')).toBeNull();
  });
});
