import { useCallback, useEffect, useRef } from 'react';

import {
  createWelcomeTune,
  type WelcomeTune,
} from '@/App/createWelcomeTune/createWelcomeTune';
import { CLOSING_CHORD, INTRO_CUE } from '@/App/welcomeScore/welcomeScore';
import type { WelcomePhase } from '@/App/welcomeStep/welcomeStep';
import { SKIP_MS } from '@/App/welcomeTimeline/welcomeTimeline';

export interface WelcomeTuneOptions {
  /** Whether this mount plays the welcome; nothing sounds unless it does. */
  played: boolean;
  /** Whether the system asks for reduced motion: then no Intro cue. */
  reducedMotion: boolean;
}

/**
 * The **Welcome tune** over the welcome's phases. It answers a step the
 * provider calls the moment a phase starts, not on a render, so a cue sounds
 * when its phase does: the **Intro cue** from the mount, as the welcome
 * starts; the **Closing chord** on `handoff`; a fade over the skip's
 * `SKIP_MS` on `skipping`; `finish()` at `done`. Under reduced motion
 * nothing plays until the chord, the whole tune. The hold sounds nothing. An
 * unmount closes the tune at once.
 */
export function useWelcomeTune({
  played,
  reducedMotion,
}: WelcomeTuneOptions): (phase: WelcomePhase) => void {
  const tune = useRef<WelcomeTune | null>(null);

  useEffect(() => {
    if (!played) {
      return undefined;
    }
    const made = createWelcomeTune();
    tune.current = made;
    if (!reducedMotion) {
      made.play(INTRO_CUE);
    }
    return () => {
      made.close();
      tune.current = null;
    };
    // Once per mount: the provider reads both inputs once, at the start.
  }, [played, reducedMotion]);

  return useCallback((phase: WelcomePhase) => {
    if (phase === 'handoff') {
      tune.current?.play(CLOSING_CHORD);
    } else if (phase === 'skipping') {
      tune.current?.fadeOut(SKIP_MS);
    } else if (phase === 'done') {
      tune.current?.finish();
    }
  }, []);
}
