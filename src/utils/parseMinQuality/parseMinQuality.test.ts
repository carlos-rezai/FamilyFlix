import { describe, it, expect } from 'vitest';

import { parseMinQuality, QUALITY_CUTOFFS } from './parseMinQuality';

describe('QUALITY_CUTOFFS', () => {
  it('is the ladder without SD, best first', () => {
    // SD's row would keep everything measured and only look like a filter.
    expect(QUALITY_CUTOFFS).toEqual(['4K', '1080p', '720p', '480p']);
  });
});

describe('parseMinQuality: a cut-off the pill can write', () => {
  it('reads every offered cut-off, lowercased, back as its rung', () => {
    expect(parseMinQuality('4k')).toBe('4K');
    expect(parseMinQuality('1080p')).toBe('1080p');
    expect(parseMinQuality('720p')).toBe('720p');
    expect(parseMinQuality('480p')).toBe('480p');
  });
});

describe('parseMinQuality: the absence of a minimum', () => {
  it('reads an absent parameter as no minimum', () => {
    expect(parseMinQuality(null)).toBeUndefined();
  });

  it('reads an empty value as no minimum', () => {
    expect(parseMinQuality('')).toBeUndefined();
  });
});

describe('parseMinQuality: a stale or hand-edited URL', () => {
  it('drops SD, a rung the pill has no row for', () => {
    // Honouring it would narrow the library behind a pill saying
    // "All qualities".
    expect(parseMinQuality('sd')).toBeUndefined();
  });

  it('drops a rung spelled in a case the pill never writes', () => {
    expect(parseMinQuality('4K')).toBeUndefined();
    expect(parseMinQuality('1080P')).toBeUndefined();
  });

  it('drops a value off the ladder', () => {
    expect(parseMinQuality('8k')).toBeUndefined();
  });
});
