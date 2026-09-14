import { Fragment } from 'react';

import type { ImportPhase } from '@/types';
import {
  Dot,
  Label,
  Rule,
  Step,
  Steps,
  type StepState,
} from './PhaseStepper.styles';

export interface PhaseStepperProps {
  /** The **Current run**'s phase, which alone says where each step is. */
  phase: ImportPhase;
}

/** The three steps, in the order the run takes them. */
const STEPS = ['Connect', 'Scan', 'Import'] as const;

/**
 * Where each step is for a phase. Connect is done the moment the step is
 * drawn — a run that is running has connected — and review, should the
 * stepper ever be drawn there, is every step done.
 */
function stateOf(step: (typeof STEPS)[number], phase: ImportPhase): StepState {
  switch (step) {
    case 'Connect':
      return 'done';
    case 'Scan':
      return phase === 'scanning' ? 'active' : 'done';
    case 'Import':
      return phase === 'importing'
        ? 'active'
        : phase === 'review'
          ? 'done'
          : 'pending';
  }
}

/**
 * The `Connect ✓ → Scan → Import` stepper over the **Running step**, from
 * `feat.ImportFlow.dc.html`: three steps, each a 24px dot and a label, a
 * hairline between them. A **done** step is ticked in the `watched` green
 * with its label dimmed; the **active** step shows its number in `accent`
 * with its label in full ink; a **pending** step shows its number on
 * `surface-3` with everything faint.
 */
export function PhaseStepper({ phase }: PhaseStepperProps) {
  return (
    <Steps>
      {STEPS.map((step, index) => {
        const state = stateOf(step, phase);
        return (
          <Fragment key={step}>
            {index > 0 ? <Rule /> : null}
            <Step aria-current={state === 'active' ? 'step' : undefined}>
              <Dot $state={state}>{state === 'done' ? '✓' : index + 1}</Dot>
              <Label $state={state}>{step}</Label>
            </Step>
          </Fragment>
        );
      })}
    </Steps>
  );
}
