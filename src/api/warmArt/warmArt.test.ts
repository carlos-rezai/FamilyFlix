import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stubImage } from '@/test-support/stubImage/stubImage';

type WarmArtModule = typeof import('./warmArt');

/**
 * The **Warm start**'s wire call. It holds state for the life of the page, so
 * each test takes a fresh copy of the module: what one test warmed is not
 * warm in the next.
 */
describe('warmArt', () => {
  const images = stubImage();
  let warmArt: WarmArtModule['warmArt'];
  let isWarm: WarmArtModule['isWarm'];

  beforeEach(async () => {
    vi.resetModules();
    ({ warmArt, isWarm } = await import('./warmArt'));
  });

  const url = (n: number) => `/api/images/title-${n}/backdrop.jpg`;

  it('fetches and decodes a url through an Image, and is warm once decoded', async () => {
    const warming = warmArt(url(1));

    expect(images.created(url(1))).toBe(1);
    expect(images.decodes(url(1))).toBe(1);
    expect(isWarm(url(1))).toBe(false);

    await images.decode(url(1));
    await warming;

    expect(isWarm(url(1))).toBe(true);
  });

  it('decodes a url once however often it is asked, warming or warm', async () => {
    void warmArt(url(1));
    void warmArt(url(1));
    await images.decode(url(1));
    await warmArt(url(1));
    await warmArt(url(1));

    expect(images.created(url(1))).toBe(1);
    expect(images.decodes(url(1))).toBe(1);
    expect(isWarm(url(1))).toBe(true);
  });

  it('keeps the last 8: the 9th url evicts the oldest', async () => {
    for (let n = 1; n <= 9; n += 1) {
      void warmArt(url(n));
      await images.decode(url(n));
    }

    expect(isWarm(url(1))).toBe(false);
    for (let n = 2; n <= 9; n += 1) {
      expect(isWarm(url(n))).toBe(true);
    }

    // Evicted, so asking again fetches it again.
    void warmArt(url(1));
    expect(images.created(url(1))).toBe(2);
  });

  it('settles quietly on a failure, holds nothing, and asks again', async () => {
    const warming = warmArt(url(1));
    await images.fail(url(1));

    await expect(warming).resolves.toBeUndefined();
    expect(isWarm(url(1))).toBe(false);

    void warmArt(url(1));
    expect(images.created(url(1))).toBe(2);
  });

  it('does nothing for null', async () => {
    await expect(warmArt(null)).resolves.toBeUndefined();

    expect(images.sources()).toEqual([]);
  });
});
