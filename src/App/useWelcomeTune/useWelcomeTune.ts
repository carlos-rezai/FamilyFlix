import { useCallback, useEffect, useRef } from 'react';

import {
  createWelcomeTune,
  type WelcomeTune,
} from '@/App/createWelcomeTune/createWelcomeTune';
import { CLOSING_CHORD, INTRO_CUE } from '@/App/welcomeScore/welcomeScore';
import type { WelcomePhase } from '@/App/welcomeStep/welcomeStep';

export interface WelcomeTuneOptions {
  /** Whether this mount plays the welcome; nothing sounds unless it does. */
  played: boolean;
}

/**
 * The **Welcome tune** over the welcome's phases. It answers a step the
 * provider calls the moment a phase starts, not on a render, so a cue sounds
 * when its phase does: the **Intro cue** from the mount, as the welcome
 * starts, the **Closing chord** on `handoff`, `finish()` at
 * `done`. An unmount closes the tune at once.
 */
export function useWelcomeTune({
  played,
}: WelcomeTuneOptions): (phase: WelcomePhase) => void {
  const tune = useRef<WelcomeTune | null>(null);

  useEffect(() => {
    if (!played) {
      return undefined;
    }
    const made = createWelcomeTune();
    tune.current = made;
    made.play(INTRO_CUE);
    return () => {
      made.close();
      tune.current = null;
    };
  }, [played]);

  return useCallback((phase: WelcomePhase) => {
    if (phase === 'handoff') {
      tune.current?.play(CLOSING_CHORD);
    } else if (phase === 'done') {
      tune.current?.finish();
    }
  }, []);
}
