// @vitest-environment node
//
// What the double promises: a path to a file that really is a film, ten
// seconds long by its own container header.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { FIXTURE_DURATION_SECONDS, FIXTURE_VIDEO } from './fixtureVideo';
import { mediaDuration } from '../../playback/mediaDuration/mediaDuration';

describe('fixtureVideo', () => {
  it('points at a file that is really an MP4', () => {
    const bytes = readFileSync(FIXTURE_VIDEO);

    // The `ftyp` box is the first thing in any ISO base-media file.
    expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp');
  });

  it('is as long as it says it is, by its own header', () => {
    expect(mediaDuration(FIXTURE_VIDEO)).toBe(FIXTURE_DURATION_SECONDS);
  });
});
