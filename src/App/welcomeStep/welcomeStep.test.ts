import { describe, it, expect } from 'vitest';

import {
  welcomeStep,
  type WelcomeEvent,
  type WelcomePhase,
  type WelcomeState,
} from './welcomeStep';

/**
 * 55, Intro animation, Phase 2 (issue #504): the **Welcome phase**, stepped.
 *
 * `welcomeStep` is pure over `{ phase, ready, skipped }` and the events the
 * provider's clock and the home send. Every transition of the PRD's Q10 is
 * here; an event with no transition leaves the state as it was.
 */

function state(
  phase: WelcomePhase,
  ready = false,
  skipped = false
): WelcomeState {
  return { phase, ready, skipped };
}

describe('welcomeStep: the intro ending', () => {
  it('hands off at the intro’s end when the home is ready', () => {
    expect(welcomeStep(state('intro', true), 'introEnded').phase).toBe(
      'handoff'
    );
  });

  it('holds at the intro’s end when the home is not ready', () => {
    expect(welcomeStep(state('intro', false), 'introEnded')).toEqual(
      state('holding', false, false)
    );
  });
});

describe('welcomeStep: ready', () => {
  it('only records an early ready, never cutting the intro', () => {
    expect(welcomeStep(state('intro', false), 'ready')).toEqual(
      state('intro', true, false)
    );
  });

  it('hands off from the hold on ready', () => {
    const next = welcomeStep(state('holding', false), 'ready');

    expect(next.phase).toBe('handoff');
    expect(next.ready).toBe(true);
  });

  it('skips from the hold on ready when a skip was asked for', () => {
    const next = welcomeStep(state('holding', false, true), 'ready');

    expect(next.phase).toBe('skipping');
    expect(next.ready).toBe(true);
  });
});

describe('welcomeStep: the skip', () => {
  it.each<WelcomePhase>(['intro', 'holding', 'handoff'])(
    'skips at once from %s when the home is ready',
    (phase) => {
      expect(welcomeStep(state(phase, true), 'skip').phase).toBe('skipping');
    }
  );

  it.each<WelcomePhase>(['intro', 'holding'])(
    'holds, the skip recorded, from %s when the home is not ready',
    (phase) => {
      expect(welcomeStep(state(phase, false), 'skip')).toEqual(
        state('holding', false, true)
      );
    }
  );
});

describe('welcomeStep: the end', () => {
  it('is done when the handoff ends', () => {
    expect(welcomeStep(state('handoff', true), 'handoffEnded').phase).toBe(
      'done'
    );
  });

  it('is done when the skip ends', () => {
    expect(welcomeStep(state('skipping', true), 'skipEnded').phase).toBe(
      'done'
    );
  });
});

describe('welcomeStep: an event with no transition', () => {
  it.each<[WelcomeState, WelcomeEvent]>([
    [state('intro', false), 'handoffEnded'],
    [state('intro', true), 'skipEnded'],
    [state('holding', false), 'introEnded'],
    [state('holding', false, true), 'skip'],
    [state('holding', false), 'handoffEnded'],
    [state('handoff', true), 'introEnded'],
    [state('handoff', true), 'ready'],
    [state('handoff', true), 'skipEnded'],
    [state('skipping', true), 'skip'],
    [state('skipping', true), 'ready'],
    [state('skipping', true), 'handoffEnded'],
    [state('done', true), 'introEnded'],
    [state('done', true), 'ready'],
    [state('done', true), 'skip'],
    [state('done', true), 'handoffEnded'],
    [state('done', true), 'skipEnded'],
  ])('leaves %o unchanged at %s', (before, event) => {
    expect(welcomeStep(before, event)).toEqual(before);
  });
});
