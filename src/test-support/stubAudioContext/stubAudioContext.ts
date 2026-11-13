import { afterEach, beforeEach } from 'vitest';

/** One scheduled change on a param, as the Web Audio automation calls make it. */
type ParamEvent =
  | { kind: 'set' | 'linear' | 'exponential'; time: number; value: number }
  | { kind: 'target'; time: number; value: number; timeConstant: number };

/**
 * A recording `AudioParam`: it remembers every automation call and answers
 * what the param's value is at any time, so a test asks what a listener would
 * hear rather than which calls were made.
 */
export class FakeAudioParam {
  private initial: number;
  private readonly events: ParamEvent[] = [];

  constructor(
    private readonly context: FakeAudioContext,
    defaultValue: number
  ) {
    this.initial = defaultValue;
  }

  get value(): number {
    return this.valueAt(this.context.currentTime);
  }

  set value(value: number) {
    if (this.events.length === 0) {
      this.initial = value;
    } else {
      this.events.push({
        kind: 'set',
        time: this.context.currentTime,
        value,
      });
    }
  }

  setValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'set', time, value });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'linear', time, value });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    if (value === 0) {
      throw new RangeError('an exponential ramp cannot reach 0');
    }
    this.events.push({ kind: 'exponential', time, value });
    return this;
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ kind: 'target', time, value, timeConstant });
    return this;
  }

  cancelScheduledValues(time: number): this {
    for (let i = this.events.length - 1; i >= 0; i -= 1) {
      if (this.events[i].time >= time) this.events.splice(i, 1);
    }
    return this;
  }

  cancelAndHoldAtTime(time: number): this {
    const held = this.valueAt(time);
    this.cancelScheduledValues(time);
    this.events.push({ kind: 'set', time, value: held });
    return this;
  }

  /** The param's value at `time`, on the context's clock. */
  valueAt(time: number): number {
    const events = [...this.events].sort((a, b) => a.time - b.time);
    let value = this.initial;
    let from = 0;
    let target: Extract<ParamEvent, { kind: 'target' }> | null = null;

    const settle = (at: number): number =>
      target === null
        ? value
        : target.value +
          (value - target.value) *
            Math.exp(-(at - target.time) / target.timeConstant);

    for (const event of events) {
      if (event.time > time) {
        const start = settle(from);
        const span = event.time - from;
        const part = span <= 0 ? 1 : (time - from) / span;
        if (event.kind === 'linear') {
          return start + (event.value - start) * part;
        }
        if (event.kind === 'exponential') {
          return start * Math.pow(event.value / start, part);
        }
        return settle(time);
      }
      if (event.kind === 'target') {
        value = settle(event.time);
        target = event;
      } else {
        value = event.value;
        target = null;
      }
      from = event.time;
    }
    return settle(time);
  }
}

/** A node in the fake graph: what it feeds. */
export class FakeAudioNode {
  readonly outputs: FakeAudioNode[] = [];

  constructor(readonly context: FakeAudioContext) {}

  connect<T extends FakeAudioNode>(destination: T): T {
    this.outputs.push(destination);
    return destination;
  }

  disconnect(destination?: FakeAudioNode): void {
    if (destination === undefined) {
      this.outputs.splice(0);
      return;
    }
    const at = this.outputs.indexOf(destination);
    if (at !== -1) this.outputs.splice(at, 1);
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain: FakeAudioParam;

  constructor(context: FakeAudioContext) {
    super(context);
    this.gain = new FakeAudioParam(context, 1);
  }
}

/**
 * A filter in the fake graph. It records its settings and passes every level
 * through unchanged: `levelAt` measures loudness, not timbre.
 */
export class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency: FakeAudioParam;
  readonly Q: FakeAudioParam;

  constructor(context: FakeAudioContext) {
    super(context);
    this.frequency = new FakeAudioParam(context, 350);
    this.Q = new FakeAudioParam(context, 1);
  }
}

export class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine';
  readonly frequency: FakeAudioParam;
  /** When `start` scheduled it, or `null` if never started. */
  startedAt: number | null = null;
  /** When `stop` scheduled its end, or `null` if never stopped. */
  stoppedAt: number | null = null;
  onended: ((event: Event) => void) | null = null;
  private readonly listeners: Array<(event: Event) => void> = [];

  constructor(context: FakeAudioContext) {
    super(context);
    this.frequency = new FakeAudioParam(context, 440);
  }

  start(when = 0): void {
    this.startedAt = Math.max(when, this.context.currentTime);
  }

  stop(when = 0): void {
    this.stoppedAt = Math.max(when, this.context.currentTime);
    this.context.whenReached(this.stoppedAt, () => {
      const event = new Event('ended');
      this.onended?.(event);
      for (const listener of this.listeners) listener(event);
    });
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    if (type === 'ended') this.listeners.push(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const at = this.listeners.indexOf(listener);
    if (type === 'ended' && at !== -1) this.listeners.splice(at, 1);
  }
}

/**
 * A recording `AudioContext`. Its clock reads `startTime` seconds when it is
 * made and runs with `Date.now()`, so a faked clock moves it. It starts in
 * the state it is given (`'running'` unless a test says the browser keeps it
 * `'suspended'`), and remembers whether it was resumed and when it was closed.
 */
export class FakeAudioContext {
  readonly destination: FakeAudioNode;
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly gains: FakeGainNode[] = [];
  readonly filters: FakeBiquadFilterNode[] = [];
  state: AudioContextState = 'running';
  /** The context's `currentTime` when `close()` was first called. */
  closedAt: number | null = null;
  resumed = false;
  private readonly madeAt = Date.now();
  private readonly timers: Array<ReturnType<typeof setTimeout>> = [];

  constructor(
    private readonly startTime: number,
    state: AudioContextState = 'running'
  ) {
    this.destination = new FakeAudioNode(this);
    this.state = state;
  }

  get currentTime(): number {
    return this.startTime + (Date.now() - this.madeAt) / 1000;
  }

  createOscillator(): FakeOscillatorNode {
    const node = new FakeOscillatorNode(this);
    this.oscillators.push(node);
    return node;
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode(this);
    this.gains.push(node);
    return node;
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    const node = new FakeBiquadFilterNode(this);
    this.filters.push(node);
    return node;
  }

  resume(): Promise<void> {
    this.resumed = true;
    return Promise.resolve();
  }

  close(): Promise<void> {
    if (this.closedAt === null) this.closedAt = this.currentTime;
    this.state = 'closed';
    return Promise.resolve();
  }

  /** Every node feeding `node` directly. */
  inputsOf(node: FakeAudioNode): FakeAudioNode[] {
    return [...this.oscillators, ...this.gains, ...this.filters].filter(
      (input) => input.outputs.includes(node)
    );
  }

  /** Runs `then` once the context's clock reaches `time`. */
  whenReached(time: number, then: () => void): void {
    const ms = Math.max(0, (time - this.currentTime) * 1000);
    this.timers.push(setTimeout(then, ms));
  }

  /** Drops every pending timer: the test is over. */
  dispose(): void {
    for (const timer of this.timers.splice(0)) clearTimeout(timer);
  }
}

/**
 * How loud `node` reaches the destination at `time`: every path's gains
 * multiplied, the paths summed. An oscillator not started yet, or stopped, is
 * silent.
 */
export function levelAt(node: FakeAudioNode, time: number): number {
  if (node instanceof FakeOscillatorNode) {
    if (node.startedAt === null || time < node.startedAt) return 0;
    if (node.stoppedAt !== null && time >= node.stoppedAt) return 0;
  }
  if (node === node.context.destination) return 1;
  const own = node instanceof FakeGainNode ? node.gain.valueAt(time) : 1;
  return node.outputs.reduce(
    (sum, output) => sum + own * levelAt(output, time),
    0
  );
}

/** What `stubAudioContext` hands a suite. */
export interface StubbedAudio {
  /** Every context made since this test started, in order. */
  contexts(): FakeAudioContext[];
  /** How many times the constructor was called this test, refused or not. */
  attempts(): number;
}

export interface StubAudioOptions {
  /** What a new context's `currentTime` reads, in seconds. Defaults to 0. */
  startTime?: number;
  /** The state a new context starts in: `'suspended'` as an autoplay policy keeps it. */
  state?: AudioContextState;
  /** The constructor throws, as it does on Linux with no audio device. */
  refuse?: boolean;
}

/**
 * jsdom has no Web Audio. Call this inside the `describe` that needs it (or at
 * a file's top), and for each test `window.AudioContext` is a recording fake:
 * every context made, its oscillators, gains and filters, how they connect, and what
 * each param does over time. Cleanup removes it, so the next file's window has
 * no `AudioContext` again, as jsdom's own doesn't. It follows
 * `stubMediaElement` in shape.
 */
export function stubAudioContext({
  startTime = 0,
  state = 'running',
  refuse = false,
}: StubAudioOptions = {}): StubbedAudio {
  const made: FakeAudioContext[] = [];
  let attempts = 0;
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    made.splice(0);
    attempts = 0;
    original = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: function AudioContext() {
        attempts += 1;
        if (refuse) {
          throw new DOMException('no audio device', 'NotSupportedError');
        }
        const context = new FakeAudioContext(startTime, state);
        made.push(context);
        return context;
      },
    });
  });

  afterEach(() => {
    for (const context of made) context.dispose();
    if (original) {
      Object.defineProperty(window, 'AudioContext', original);
    } else {
      delete (window as Partial<Record<'AudioContext', unknown>>).AudioContext;
    }
  });

  return { contexts: () => [...made], attempts: () => attempts };
}
