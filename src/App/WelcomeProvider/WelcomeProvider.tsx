import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import { isLaunchEntry } from '@/utils';
import { WelcomeContext, type WelcomeApi } from '@/App/useWelcome/useWelcome';
import {
  welcomeStep,
  type WelcomeEvent,
  type WelcomePhase,
  type WelcomeState,
} from '@/App/welcomeStep/welcomeStep';
import {
  WelcomeSplash,
  type WordmarkLanding,
} from '@/App/WelcomeSplash/WelcomeSplash';
import { HomeLayer } from './WelcomeProvider.styles';

/** The `sessionStorage` flag a played welcome leaves for the session. */
const WELCOMED_KEY = 'familyflix.welcomed';

/** The **Welcome intro** and the **Wordmark handoff**, in ms. */
const INTRO_MS = 1750;
const HANDOFF_MS = 500;

/** The phases the clock ends on its own: how long each lasts, and its end. */
const CLOCK: Partial<Record<WelcomePhase, { ms: number; ends: WelcomeEvent }>> =
  {
    intro: { ms: INTRO_MS, ends: 'introEnded' },
    handoff: { ms: HANDOFF_MS, ends: 'handoffEnded' },
  };

/** The design's frame the geometry scales from (log 55 Q13). */
const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 270;

/** The splash wordmark's `font-size` at scale 1 (log 55 Q13). */
const SPLASH_FONT_PX = 30;

/**
 * Where the splash wordmark lands: the header wordmark's top-left, and its
 * `font-size` over the splash's. `null` when there is nothing to measure.
 */
function measureLanding(
  header: HTMLElement | null,
  scale: number
): WordmarkLanding | null {
  if (header === null) {
    return null;
  }
  const { left, top } = header.getBoundingClientRect();
  const headerPx = parseFloat(getComputedStyle(header).fontSize);
  if (Number.isNaN(headerPx)) {
    return null;
  }
  return { left, top, ratio: headerPx / (SPLASH_FONT_PX * scale) };
}

/** Whether this session was welcomed already; a refused read is a no. */
function wasWelcomed(): boolean {
  try {
    return sessionStorage.getItem(WELCOMED_KEY) !== null;
  } catch {
    return false;
  }
}

/** Leaves the flag; a refused write is let go, the welcome plays regardless. */
function markWelcomed(): void {
  try {
    sessionStorage.setItem(WELCOMED_KEY, 'true');
  } catch {
    // Nothing to do: at worst a reload plays the welcome again.
  }
}

export interface WelcomeProviderProps {
  /** The routes: the **Home layer**'s content. */
  children: ReactNode;
}

/**
 * The renderer's welcome. It decides, once, whether this mount is a **Cold
 * start** (the **Launch entry** and no `familyflix.welcomed` flag in
 * `sessionStorage`), sets the flag, and on one draws the **Welcome splash**
 * over the **Home layer** and runs the clock through `welcomeStep`: 1750ms
 * of intro, then the 500ms **Wordmark handoff**: at its start the header
 * wordmark is measured and the splash wordmark glides onto it. The home is
 * **Ready** when the header wordmark mounts on `useWelcome`'s ref; until the
 * end the header wordmark is hidden. At `done`, in one frame, the wordmark
 * shows, the splash unmounts, the Home layer loses its style and focus lands
 * on the header's logo button. Anywhere else it draws nothing but its
 * children.
 */
export function WelcomeProvider({ children }: WelcomeProviderProps) {
  const location = useLocation();
  const [played] = useState(() => isLaunchEntry(location) && !wasWelcomed());
  const [scale] = useState(() =>
    played
      ? Math.min(
          window.innerWidth / FRAME_WIDTH,
          window.innerHeight / FRAME_HEIGHT
        )
      : 1
  );
  const [state, setState] = useState<WelcomeState>(() => ({
    phase: played ? 'intro' : 'done',
    ready: !played,
    skipped: false,
  }));
  const current = useRef(state);
  const { phase } = state;
  const wordmark = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [landing, setLanding] = useState<WordmarkLanding | null>(null);

  // The clock runs off the state it just stepped to, not off a render, so a
  // phase's timer starts the moment the phase does.
  const send = useCallback(
    (event: WelcomeEvent) => {
      const before = current.current;
      const next = welcomeStep(before, event);
      if (next === before) {
        return;
      }
      current.current = next;
      if (next.phase === 'handoff' && before.phase !== 'handoff') {
        setLanding(measureLanding(wordmark.current, scale));
      }
      setState(next);
      if (next.phase !== before.phase) {
        startClock(next.phase);
      }
    },
    [scale]
  );

  function startClock(at: WelcomePhase) {
    clearTimeout(timer.current);
    const leg = CLOCK[at];
    if (leg !== undefined) {
      timer.current = setTimeout(() => send(leg.ends), leg.ms);
    }
  }

  useEffect(() => {
    if (!played) {
      return undefined;
    }
    markWelcomed();
    startClock(current.current.phase);
    return () => clearTimeout(timer.current);
    // Once per mount: the clock then drives itself through `send`.
  }, [played]);

  useLayoutEffect(() => {
    if (played && phase === 'done') {
      wordmark.current?.closest('button')?.focus();
    }
  }, [played, phase]);

  const wordmarkRef = useCallback(
    (element: HTMLElement | null) => {
      if (element !== null) {
        wordmark.current = element;
        send('ready');
      }
    },
    [send]
  );

  const api = useMemo<WelcomeApi>(
    () => ({ wordmarkRef, wordmarkHidden: phase !== 'done' }),
    [wordmarkRef, phase]
  );

  return (
    <WelcomeContext.Provider value={api}>
      <HomeLayer $phase={phase}>{children}</HomeLayer>
      {phase !== 'done' && (
        <WelcomeSplash
          scale={scale}
          landing={landing}
          handingOff={phase === 'handoff'}
        />
      )}
    </WelcomeContext.Provider>
  );
}
