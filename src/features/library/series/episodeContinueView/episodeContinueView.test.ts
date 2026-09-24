import { describe, it, expect } from 'vitest';

import { episodeContinueView } from './episodeContinueView';
import type { EpisodeContinueEntry, Episode } from '@/types';

function makeEntry(overrides: Partial<Episode> = {}): EpisodeContinueEntry {
  return {
    series: { id: 's1', title: 'Harbor & Vine' },
    episode: {
      id: 'e24',
      seriesId: 's1',
      season: 2,
      number: 4,
      title: 'Low Tide',
      airDate: null,
      runtimeMinutes: 45,
      watched: false,
      resumePositionSeconds: 720,
      status: 'in-progress',
      videoPath: 'harbor-vine-2019/season-02/e04.mp4',
      subtitles: [],
      lastWatchedAt: '2026-09-20T00:00:00.000Z',
      ...overrides,
    },
  };
}

describe('episodeContinueView — entry → ContinueCardMovie mapper', () => {
  it('carries the episode id, so the card opens the episode', () => {
    expect(episodeContinueView(makeEntry()).id).toBe('e24');
  });

  it('reads the title as Series · SnnEnn', () => {
    expect(episodeContinueView(makeEntry()).title).toBe(
      'Harbor & Vine · S02E04'
    );
    expect(
      episodeContinueView(makeEntry({ season: 12, number: 13 })).title
    ).toBe('Harbor & Vine · S12E13');
  });

  it('builds the Resume label from the position and the runtime', () => {
    expect(episodeContinueView(makeEntry()).resumeLabel).toBe(
      'Resume · 12:00 of 45:00'
    );
  });

  it('builds the Resume label from the position alone for an unknown runtime', () => {
    expect(
      episodeContinueView(
        makeEntry({ runtimeMinutes: null, resumePositionSeconds: 300 })
      ).resumeLabel
    ).toBe('Resume · 5:00');
  });

  it('fills the progress by the position over the runtime', () => {
    expect(episodeContinueView(makeEntry()).progress).toBeCloseTo(
      (720 / 2700) * 100
    );
  });
});
