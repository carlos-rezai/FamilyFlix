import type {
  WelcomeNote,
  WelcomeVoice,
} from '@/App/welcomeScore/welcomeScore';
import { MARK_SWEEP_MS } from '@/App/welcomeTimeline/welcomeTimeline';

/** The **Welcome tune**'s player. */
export interface WelcomeTune {
  /** Schedules a cue's notes from now. */
  play(cue: readonly WelcomeNote[]): void;
  /** Ramps the master to silence over `ms`, then closes. */
  fadeOut(ms: number): void;
  /** Closes once the last note played has died away; after a fade, nothing. */
  finish(): void;
  /** Closes at once. */
  close(): void;
}

/** The fixed level every note sounds under (log 62 Q7). */
const MASTER_LEVEL = 0.3;

/** A bell's rise, in s, and its octave partial's share of its level. */
const BELL_RISE = 0.08;
const BELL_OCTAVE = 0.1;

/** A pluck's rise, in s (log 62 Q6). */
const PLUCK_RISE = 0.012;

/** A swell's rise, in s: it peaks at the mark sweep's middle (log 62 Q6). */
const SWELL_RISE = MARK_SWEEP_MS / 2 / 1000;

/**
 * The lowpass the master sounds through, in Hz, and its Q: it softens the
 * tune's top (the handoff's Voices).
 */
const BRIGHTNESS_HZ = 4700;
const BRIGHTNESS_Q = 0.5;

/** Where an exponential fall ends, as a share of its peak: inaudible. */
const FLOOR = 1e-4;

/** Slack after a cue's last note before the context closes, in ms. */
const CLOSE_SLACK_MS = 50;

const frequencyOf = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

const SILENT: WelcomeTune = {
  play: () => undefined,
  fadeOut: () => undefined,
  finish: () => undefined,
  close: () => undefined,
};

/** How a voice's level moves over a note, on its envelope's gain. */
type Shape = (
  gain: AudioParam,
  level: number,
  start: number,
  end: number
) => void;

/** A fast linear rise, then an exponential fall to nothing at the end. */
const struck =
  (rise: number): Shape =>
  (gain, level, start, end) => {
    gain.setValueAtTime(0, start);
    gain.linearRampToValueAtTime(level, start + rise);
    gain.exponentialRampToValueAtTime(level * FLOOR, end);
  };

/** A slow linear rise, then a linear fall to silence at the end. */
const swelled: Shape = (gain, level, start, end) => {
  gain.setValueAtTime(0, start);
  gain.linearRampToValueAtTime(level, start + SWELL_RISE);
  gain.linearRampToValueAtTime(0, end);
};

/** One sine of a voice: its frequency and level as shares of its note's. */
interface VoicePartial {
  ratio: number;
  share: number;
  shape: Shape;
}

/** Each voice as the partials it sounds (log 62 Q6). */
const VOICES: Record<WelcomeVoice, readonly VoicePartial[]> = {
  pluck: [{ ratio: 1, share: 1, shape: struck(PLUCK_RISE) }],
  swell: [{ ratio: 1, share: 1, shape: swelled }],
  bell: [
    { ratio: 1, share: 1, shape: struck(BELL_RISE) },
    { ratio: 2, share: BELL_OCTAVE, shape: struck(BELL_RISE) },
  ],
};

/** The graph a note sounds into: the context and its master gain. */
interface Graph {
  context: AudioContext;
  master: AudioNode;
}

/** One sine at `frequency`, shaped to peak at `level`, into the master. */
function sound(
  { context, master }: Graph,
  shape: Shape,
  frequency: number,
  level: number,
  start: number,
  end: number
): void {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  const envelope = context.createGain();
  shape(envelope.gain, level, start, end);
  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.start(start);
  oscillator.stop(end);
}

/** Sounds `note` in its voice, from `start` to `end` on the context's clock. */
function strike(
  graph: Graph,
  note: WelcomeNote,
  start: number,
  end: number
): void {
  const frequency = frequencyOf(note.pitch);
  for (const { ratio, share, shape } of VOICES[note.voice]) {
    sound(graph, shape, ratio * frequency, share * note.level, start, end);
  }
}

/**
 * The only code that touches Web Audio. The context is made on the first
 * `play`, never resumed; with no `AudioContext`, or one that throws, the tune
 * is silent and every call does nothing.
 */
export function createWelcomeTune(): WelcomeTune {
  if (typeof window.AudioContext !== 'function') {
    return SILENT;
  }

  let context: AudioContext;
  try {
    context = new window.AudioContext();
  } catch {
    return SILENT;
  }
  const master = context.createGain();
  master.gain.value = MASTER_LEVEL;
  const brightness = context.createBiquadFilter();
  brightness.type = 'lowpass';
  brightness.frequency.value = BRIGHTNESS_HZ;
  brightness.Q.value = BRIGHTNESS_Q;
  master.connect(brightness);
  brightness.connect(context.destination);
  const graph: Graph = { context, master };

  let lastEnd = 0;
  let closing: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let fading = false;

  function close(): void {
    clearTimeout(closing);
    closed = true;
    if (context.state !== 'closed') {
      void context.close();
    }
  }

  function closeIn(ms: number): void {
    clearTimeout(closing);
    closing = setTimeout(close, Math.max(0, Math.ceil(ms)) + CLOSE_SLACK_MS);
  }

  return {
    play(cue) {
      if (closed) return;
      const now = context.currentTime;
      for (const note of cue) {
        const start = now + note.at / 1000;
        const end = start + note.length / 1000;
        strike(graph, note, start, end);
        lastEnd = Math.max(lastEnd, end);
      }
    },
    fadeOut(ms) {
      if (closed) return;
      fading = true;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + ms / 1000);
      closeIn(ms);
    },
    finish() {
      if (closed || fading) return;
      closeIn((lastEnd - context.currentTime) * 1000);
    },
    close,
  };
}
