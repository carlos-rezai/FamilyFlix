import { describe, expect, it } from 'vitest';

import type { Subtitle } from '@/types';

import { subtitleLabel } from './subtitleLabel';

/**
 * 50, Subtitle picker, Phase 3 (issue #437).
 *
 * The **Subtitle label**: what the **Subtitle picker** draws for one
 * **Subtitle**. Its language, and ` · Track N` after it only when another row
 * shares that language, N its place in track order (ascending `position`) from
 * 1. The server's audio labels follow the same tie rule; this one runs client
 * side because a Subtitle's language is already the human name. Never the
 * filename.
 */
function row(id: string, language: string, position: number): Subtitle {
  return { id, path: `Northwind (2018)/${id}.srt`, language, position };
}

function labels(subtitles: Subtitle[]): string[] {
  return subtitles.map((subtitle) => subtitleLabel(subtitle, subtitles));
}

describe('subtitleLabel', () => {
  it('labels a lone language as just the language', () => {
    const english = row('s1', 'English', 0);
    const spanish = row('s2', 'Spanish', 1);

    expect(labels([english, spanish])).toEqual(['English', 'Spanish']);
  });

  it('labels a film with one Subtitle as just its language', () => {
    expect(labels([row('s1', 'English', 0)])).toEqual(['English']);
  });

  it('suffixes each of two sharing a language with its place in track order', () => {
    expect(labels([row('s1', 'English', 0), row('s2', 'English', 1)])).toEqual([
      'English · Track 1',
      'English · Track 2',
    ]);
  });

  it('counts by track order, not by the order the rows arrive in', () => {
    const first = row('s1', 'English', 0);
    const second = row('s2', 'English', 1);
    const arrived = [second, first];

    expect(subtitleLabel(first, arrived)).toBe('English · Track 1');
    expect(subtitleLabel(second, arrived)).toBe('English · Track 2');
  });

  it('leaves a third, distinct language bare beside a tie', () => {
    expect(
      labels([
        row('s1', 'English', 0),
        row('s2', 'French', 1),
        row('s3', 'English', 2),
      ])
    ).toEqual(['English · Track 1', 'French', 'English · Track 3']);
  });

  it('treats languages that differ only in case as a tie', () => {
    expect(labels([row('s1', 'English', 0), row('s2', 'english', 1)])).toEqual([
      'English · Track 1',
      'english · Track 2',
    ]);
  });
});
