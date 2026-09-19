// @vitest-environment node
//
// 16 — Playback component upload, Phase 1: "the slot resolves what is live,
// and it has a row" (issue #152).
//
// The double the **Component slot** is replaced by everywhere a test used to
// hand `createPlayback` a component: a slot that answers one component, an
// `info()` for it, and refuses to receive or remove. Thirty-odd call sites
// across the playback, route and importer suites reach the domain through it,
// which is exactly why its own contract is written down once here rather than
// inferred from the suites that lean on it.
//
// It is a test double, so it lives beside `heldCopy` and `libraryFixture` and
// nothing that ships imports it.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../../playback/ffmpegComponent/ffmpegComponent';

import { fixedSlot } from './fixedSlot';

/** A component that answers nothing and spawns nothing. */
function fakeComponent(): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => null,
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
}

describe('fixedSlot — the component it holds', () => {
  it('answers the component it was given', () => {
    const component = fakeComponent();

    expect(fixedSlot(component).current()).toBe(component);
  });

  it('answers the same component on every call', () => {
    // Fixed is the whole of it: nothing a suite does to the slot changes what
    // the next call answers.
    const slot = fixedSlot(fakeComponent());

    expect(slot.current()).toBe(slot.current());
  });

  it('answers null for the machine with no component at all', () => {
    const slot = fixedSlot(null);

    expect(slot.current()).toBeNull();
    expect(slot.info()).toBeNull();
  });
});

describe('fixedSlot — what it says about that component', () => {
  it('describes a component it was given no info for as the default one', () => {
    expect(fixedSlot(fakeComponent()).info()?.source).toBe('default');
  });

  it('answers the info it was given', () => {
    const info = {
      source: 'uploaded' as const,
      bytes: 98_765_432,
      files: ['ffmpeg.exe', 'ffprobe.exe'],
    };

    expect(fixedSlot(fakeComponent(), info).info()).toEqual(info);
  });
});

describe('fixedSlot — what it refuses', () => {
  it('refuses to receive an upload', () => {
    // A double that quietly accepted one would let a suite believe it had
    // installed a component that nothing ever swapped.
    const slot = fixedSlot(fakeComponent());

    expect(typeof slot.receive).toBe('function');
    expect(() => slot.receive()).toThrow();
  });

  it('refuses to remove the component', () => {
    const slot = fixedSlot(fakeComponent());

    expect(typeof slot.remove).toBe('function');
    expect(() => slot.remove()).toThrow();
  });
});
