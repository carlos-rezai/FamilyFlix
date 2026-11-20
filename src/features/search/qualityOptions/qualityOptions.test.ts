import { describe, it, expect, vi } from 'vitest';

import type { VideoQuality } from '@/types';
import { ALL_QUALITIES, qualityLabel, qualityOptions } from './qualityOptions';

/**
 * 70, Video quality, Phase 7 (issue #670): the Quality pill's vocabulary,
 * `ratingOptions`' shape. The rows in the handoff's order
 * (`handoff-video-quality/README.md`, The Quality pill), each paired with the
 * minimum rung it reports; _All qualities_ reports none. There is no _SD+_
 * row: it would keep everything measured and look like a filter.
 */
const ROW_MINIMUMS = [
  ['All qualities', undefined],
  ['4K', '4K'],
  ['1080p+', '1080p'],
  ['720p+', '720p'],
  ['480p+', '480p'],
] as const;

const QUALITY_ROWS = ROW_MINIMUMS.map(([label]) => label);

/** The options built for a given minimum, with nothing listening. */
const optionsFor = (selected?: VideoQuality) =>
  qualityOptions(selected, () => undefined);

describe('qualityOptions — the rows', () => {
  it('lists “All qualities” first, then the rungs best first', () => {
    expect(ALL_QUALITIES).toBe('All qualities');
    expect(optionsFor().map((option) => option.label)).toEqual(QUALITY_ROWS);
  });

  it('offers no SD+ row', () => {
    const labels = optionsFor().map((option) => option.label);

    expect(labels).toHaveLength(5);
    expect(labels.some((label) => label.startsWith('SD'))).toBe(false);
  });

  it('carries no count', () => {
    for (const option of optionsFor()) {
      expect(option.count).toBeUndefined();
    }
  });
});

describe('qualityOptions — what choosing a row asks for', () => {
  it('reports the minimum rung each row stands for', () => {
    for (const [label, minimum] of ROW_MINIMUMS) {
      const onSelect = vi.fn<(minQuality: VideoQuality | undefined) => void>();
      const option = qualityOptions(undefined, onSelect).find(
        (candidate) => candidate.label === label
      );

      option?.onSelect();

      expect(onSelect).toHaveBeenCalledWith(minimum);
    }
  });

  it('tells nobody anything until a row is actually chosen', () => {
    const onSelect = vi.fn<(minQuality: VideoQuality | undefined) => void>();

    qualityOptions('1080p', onSelect);

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('qualityOptions — which row reads as chosen', () => {
  it('marks exactly the row for the minimum that is set', () => {
    for (const [label, minimum] of ROW_MINIMUMS) {
      const chosen = optionsFor(minimum).filter((option) => option.selected);

      expect(chosen.map((option) => option.label)).toEqual([label]);
    }
  });

  it('falls back to “All qualities” for SD, which has no row', () => {
    const chosen = optionsFor('SD').filter((option) => option.selected);

    expect(chosen.map((option) => option.label)).toEqual([ALL_QUALITIES]);
  });
});

describe('qualityLabel — what the pill shows', () => {
  it('names each minimum the way its row does, and “All qualities” for none', () => {
    for (const [label, minimum] of ROW_MINIMUMS) {
      expect(qualityLabel(minimum)).toBe(label);
    }
  });

  it('says “All qualities” for SD, which has no row', () => {
    expect(qualityLabel('SD')).toBe(ALL_QUALITIES);
  });
});
