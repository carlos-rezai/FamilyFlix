import type { WelcomeNote } from '@/App/welcomeScore/welcomeScore';

/** The **Welcome tune**'s player. */
export interface WelcomeTune {
  /** Schedules a cue's notes from now. */
  play(cue: readonly WelcomeNote[]): void;
  /** Ramps the master to silence over `ms`, then closes. */
  fadeOut(ms: number): void;
  /** Closes once the last note played has died away. */
  finish(): void;
  /** Closes at once. */
  close(): void;
}

/** The fixed level every note sounds under (log 62 Q7). */
const MASTER_LEVEL = 0.3;

/** A bell's rise, in s, and its octave partial's share of its level. */
const BELL_RISE = 0.01;
const BELL_OCTAVE = 0.25;

/** A pluck's rise and a swell's, in s (log 62 Q6). */
const PLUCK_RISE = 0.005;
const SWELL_RISE = 0.35;

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

/** One oscillator at `frequency`, shaped to peak at `level`, into `master`. */
function sound(
  context: AudioContext,
  master: AudioNode,
  type: OscillatorType,
  shape: Shape,
  frequency: number,
  level: number,
  start: number,
  end: number
): void {
  const oscillator = context.createOscillator();
  oscillator.type = type;
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
  context: AudioContext,
  master: AudioNode,
  note: WelcomeNote,
  start: number,
  end: number
): void {
  const frequency = frequencyOf(note.pitch);
  const at = (type: OscillatorType, shape: Shape, hz: number, level: number) =>
    sound(context, master, type, shape, hz, level, start, end);
  switch (note.voice) {
    case 'pluck':
      at('triangle', struck(PLUCK_RISE), frequency, note.level);
      return;
    case 'swell':
      at('sine', swelled, frequency, note.level);
      return;
    case 'bell':
      at('sine', struck(BELL_RISE), frequency, note.level);
      at('sine', struck(BELL_RISE), 2 * frequency, note.level * BELL_OCTAVE);
      return;
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

  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let lastEnd = 0;
  let closing: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function open(): { context: AudioContext; master: GainNode } | null {
    if (closed) return null;
    if (context !== null && master !== null) return { context, master };
    try {
      context = new window.AudioContext();
    } catch {
      closed = true;
      return null;
    }
    master = context.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(context.destination);
    return { context, master };
  }

  function close(): void {
    clearTimeout(closing);
    closed = true;
    if (context !== null && context.state !== 'closed') {
      void context.close();
    }
  }

  function closeIn(ms: number): void {
    clearTimeout(closing);
    closing = setTimeout(close, Math.max(0, Math.ceil(ms)) + CLOSE_SLACK_MS);
  }

  return {
    play(cue) {
      const graph = open();
      if (graph === null) return;
      const now = graph.context.currentTime;
      for (const note of cue) {
        const start = now + note.at / 1000;
        const end = start + note.length / 1000;
        strike(graph.context, graph.master, note, start, end);
        lastEnd = Math.max(lastEnd, end);
      }
    },
    fadeOut(ms) {
      if (context === null || master === null || closed) return;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + ms / 1000);
      closeIn(ms);
    },
    finish() {
      if (context === null || closed) return;
      closeIn((lastEnd - context.currentTime) * 1000);
    },
    close,
  };
}
