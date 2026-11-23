// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// The double every `createMedia` suite not about the fitting hands the media
// domain: no fit, so every picture is stored as given.

import { describe, expect, it } from 'vitest';

import { unfittedArt } from './unfittedArt';

describe('unfittedArt', () => {
  it('answers no fit unscripted, for want of a component', async () => {
    expect(
      await unfittedArt().fitArt(Buffer.from('picture'), 1920, 'jpeg')
    ).toEqual({ kind: 'none', reason: 'no-component' });
  });

  it('answers the scripted outcome when handed one', async () => {
    const outcome = { kind: 'fitted' as const, picture: Buffer.from('fit') };

    expect(
      await unfittedArt(async () => outcome).fitArt(
        Buffer.from('picture'),
        780,
        'png'
      )
    ).toBe(outcome);
  });
});
