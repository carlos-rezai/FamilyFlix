import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stubMediaElement } from './stubMediaElement';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * jsdom does no media: `play()` is a not-implemented stub that returns nothing
 * at all, and `paused` never moves off `true` however the element is driven. A
 * hook binding element state to React state therefore cannot be observed in a
 * test at all — which is the whole of what `usePlayback` is.
 *
 * So this is scaffolding, and the claims below are the ones the player's suites
 * lean on: an element that plays, an element that refuses to autoplay, the
 * events a listener is attached for, and — the reason it is shared — a
 * prototype left exactly as it was found once the installing block is over.
 *
 * It follows `stubScrollMetrics` in shape, with one difference forced by the
 * DOM: jsdom defines all six of these on `HTMLMediaElement.prototype` itself,
 * so cleanup has to **restore** the original descriptors rather than delete
 * them. A `delete` would take jsdom's own implementations with it and leave
 * every later file in the worker without a media element at all.
 */
const STUBBED = [
  'play',
  'pause',
  'currentTime',
  'duration',
  'paused',
  'readyState',
] as const;

/**
 * What jsdom's prototype looks like before anything here has run — captured at
 * module load, so the last block can compare against it rather than against a
 * description of it.
 */
const ORIGINAL_DESCRIPTORS = new Map(
  STUBBED.map((property) => [
    property,
    Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, property),
  ])
);

/** Every event fired at an element, in order, for the ones a hook listens for. */
function recordEvents(element: HTMLMediaElement, ...types: string[]): string[] {
  const seen: string[] = [];
  for (const type of types) {
    element.addEventListener(type, () => seen.push(type));
  }
  return seen;
}

describe('stubMediaElement — inside the block that installed it', () => {
  stubMediaElement();

  it('puts every property the player drives on the prototype', () => {
    for (const property of STUBBED) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        property
      );

      expect(descriptor).toBeDefined();
      expect(descriptor).not.toEqual(ORIGINAL_DESCRIPTORS.get(property));
    }
  });

  it('starts an element the way a browser hands one over', () => {
    const video = document.createElement('video');

    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(0);
    expect(video.readyState).toBe(0);
    // Unknown, which is the truth for a stream and the reason nothing in the
    // player is allowed to ask: a duration comes from the playback read.
    expect(video.duration).toBeNaN();
  });

  it('plays, and says so through the event a hook is listening for', async () => {
    const video = document.createElement('video');
    const events = recordEvents(video, 'play');

    await video.play();

    expect(video.paused).toBe(false);
    expect(events).toEqual(['play']);
  });

  it('answers play() with a promise, which jsdom’s own does not', () => {
    const video = document.createElement('video');

    const result = video.play();

    // The autoplay policy is expressed as a rejected promise, so a `play()`
    // returning `undefined` cannot express the state the big-play circle exists
    // for.
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  it('pauses, and says so through its own event', async () => {
    const video = document.createElement('video');
    const events = recordEvents(video, 'pause');
    await video.play();

    video.pause();

    expect(video.paused).toBe(true);
    expect(events).toEqual(['pause']);
  });

  it('remembers a position written to it, per element', () => {
    const film = document.createElement('video');
    const other = document.createElement('video');

    film.currentTime = 1840;
    other.currentTime = 12;

    expect(film.currentTime).toBe(1840);
    expect(other.currentTime).toBe(12);
  });

  it('lets a test stage how much of the film has arrived', () => {
    // `readyState` is how a suite says "this element has nothing to show yet"
    // without a network anywhere near it.
    const video = document.createElement('video');

    Object.assign(video, { readyState: 4 });

    expect(video.readyState).toBe(4);
  });
});

describe('stubMediaElement — a block where the browser refuses autoplay', () => {
  stubMediaElement({ autoplay: 'refused' });

  it('rejects the play the page made on its own, and leaves the film stopped', async () => {
    const video = document.createElement('video');
    const events = recordEvents(video, 'play');

    await expect(video.play()).rejects.toThrow();

    expect(video.paused).toBe(true);
    expect(events).toEqual([]);
  });

  it('allows the next one, the way a browser allows a press', async () => {
    // What the policy actually is: the film the page started by itself is
    // refused, and the one a person asked for is not. Modelling it as "every
    // play fails" would make the big-play circle untestable, since the whole
    // claim is that one press starts the film.
    const video = document.createElement('video');
    await video.play().catch(() => undefined);

    await video.play();

    expect(video.paused).toBe(false);
  });
});

describe('stubMediaElement — after those blocks have finished', () => {
  it('hands the media element back to jsdom exactly as it was found', () => {
    for (const property of STUBBED) {
      expect(
        Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, property)
      ).toEqual(ORIGINAL_DESCRIPTORS.get(property));
    }
  });
});

/**
 * The `test-support/` rung's one rule, checked rather than trusted: these
 * doubles are never imported by shipping code. A stub that reached a shipped
 * bundle would replace the real media element in front of the family, and
 * nothing else in the build would notice.
 */
describe('stubMediaElement — the rung’s rule', () => {
  it('is imported by no shipping file', () => {
    const shipping = sourceFiles('src').concat(sourceFiles('server/src'));

    const importers = shipping.filter((file) =>
      readFileSync(file, 'utf8').includes('stubMediaElement')
    );

    expect(importers).toEqual([]);
  });
});

/**
 * Every `.ts`/`.tsx` file under `root` that ships — tests excluded, and the
 * whole `test-support/` rung excluded with them, since a double importing
 * another double is the rung working rather than the rule breaking.
 */
function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((entry) => join(root, entry))
    .filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.(test|spec)\.tsx?$/.test(file) &&
        !file.includes('test-support')
    );
}
