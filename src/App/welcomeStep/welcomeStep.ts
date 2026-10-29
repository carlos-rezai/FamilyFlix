/**
 * A **Welcome phase**: the **Welcome intro**, the **Welcome hold**, the
 * **Wordmark handoff**, the skip's fade, or over.
 */
export type WelcomePhase =
  | 'intro'
  | 'holding'
  | 'handoff'
  | 'skipping'
  | 'done';

/** What the provider's clock and the home send the welcome. */
export type WelcomeEvent =
  | 'introEnded'
  | 'ready'
  | 'skip'
  | 'handoffEnded'
  | 'skipEnded';

/**
 * The welcome's state: its phase, whether the home is **Ready** (its header
 * wordmark mounted) and whether a skip was asked for.
 */
export interface WelcomeState {
  phase: WelcomePhase;
  ready: boolean;
  skipped: boolean;
}

/**
 * One step of the welcome (log 55 Q10). The intro ends in the handoff when
 * the home is ready, else in the hold; an early `ready` is only recorded, so
 * a home ready early never cuts the intro short. The hold leaves on `ready`,
 * for the handoff or, when a skip was asked for, the skip. A skip goes at
 * once when the home is ready (a handoff included), else holds with the skip
 * recorded. The handoff and the skip each end in `done`. Any other event
 * leaves the state as it was.
 */
export function welcomeStep(
  state: WelcomeState,
  event: WelcomeEvent
): WelcomeState {
  const { phase, ready } = state;

  switch (event) {
    case 'introEnded':
      if (phase !== 'intro') return state;
      return { ...state, phase: ready ? 'handoff' : 'holding' };
    case 'ready':
      if (phase === 'intro') return { ...state, ready: true };
      if (phase !== 'holding') return state;
      return {
        ...state,
        ready: true,
        phase: state.skipped ? 'skipping' : 'handoff',
      };
    case 'skip':
      if (phase === 'skipping' || phase === 'done') return state;
      return { ...state, phase: ready ? 'skipping' : 'holding', skipped: true };
    case 'handoffEnded':
      return phase === 'handoff' ? { ...state, phase: 'done' } : state;
    case 'skipEnded':
      return phase === 'skipping' ? { ...state, phase: 'done' } : state;
  }
}
