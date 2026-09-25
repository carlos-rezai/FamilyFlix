// @vitest-environment node
//
// Series read — the series page's read, the player's read of one episode, and
// a series' episode list, through `LibraryStorage` over a real `:memory:`
// database. The storage half of what the router suites asserted of
// `GET /api/series/:id` and `GET /api/episodes/:id`; they keep the 404 and the
// payload.

import { describe, expect, it } from 'vitest';

import type { LibraryStorage } from '../..';
import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

/** `S01E02`, the way the assertions below read an episode. */
const tag = (episode: { season: number; number: number } | null) =>
  episode === null
    ? null
    : `S${String(episode.season).padStart(2, '0')}E${String(
        episode.number
      ).padStart(2, '0')}`;

/** Harbor & Vine: two episodes in season 1, three in season 2, added out of order. */
function seedHarbor(storage: LibraryStorage): string {
  const series = storage.addSeries({
    title: 'Harbor & Vine',
    year: 2019,
    genres: ['Drama', 'Comedy'],
  });
  for (const [season, number] of [
    [2, 1],
    [1, 2],
    [2, 3],
    [1, 1],
    [2, 2],
  ]) {
    storage.addEpisode(series.id, {
      season,
      number,
      videoPath: `harbor-vine-2019/season-0${season}/e${number}.mp4`,
    });
  }
  return series.id;
}

/**
 * Harbor & Vine for the player's read: S01E01–S01E02, then S02E01 _The Return_
 * and S02E04 _The Auction_ — a gap in the numbers, so "next" is the next held,
 * not number + 1.
 */
function seedWithGap(storage: LibraryStorage): Record<string, string> {
  const series = storage.addSeries({ title: 'Harbor & Vine', year: 2019 });
  const shape: [string, number, number, string | undefined][] = [
    ['S01E01', 1, 1, undefined],
    ['S01E02', 1, 2, 'Low Tide'],
    ['S02E01', 2, 1, 'The Return'],
    ['S02E04', 2, 4, 'The Auction'],
  ];
  const ids: Record<string, string> = {};
  for (const [code, season, number, title] of shape) {
    ids[code] = storage.addEpisode(series.id, {
      season,
      number,
      title,
      videoPath: `harbor-vine-2019/season-0${season}/${code}.mp4`,
    }).id;
  }
  return ids;
}

describe('series read: listEpisodes', () => {
  it('answers a series’ episodes in season, then episode order', () => {
    const storage = freshStorage();
    const id = seedHarbor(storage);

    expect(storage.listEpisodes(id).map(tag)).toEqual([
      'S01E01',
      'S01E02',
      'S02E01',
      'S02E02',
      'S02E03',
    ]);
  });

  it('answers no episodes for a series with none, or an id it does not hold', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Lighthouse Keepers' });

    expect(storage.listEpisodes(series.id)).toEqual([]);
    expect(storage.listEpisodes('no-such-series')).toEqual([]);
  });
});

describe('series read: getSeriesDetail', () => {
  it('answers the seasons in order, each with its episodes in order', () => {
    const storage = freshStorage();
    const detail = storage.getSeriesDetail(seedHarbor(storage));

    expect(detail?.seasons.map((season) => season.number)).toEqual([1, 2]);
    expect(detail?.seasons[0].episodes.map(tag)).toEqual(['S01E01', 'S01E02']);
    expect(detail?.seasons[1].episodes.map(tag)).toEqual([
      'S02E01',
      'S02E02',
      'S02E03',
    ]);
  });

  it('answers each episode with its derived watch status', () => {
    const storage = freshStorage();
    const id = seedHarbor(storage);
    storage.setEpisodeWatched(storage.listEpisodes(id)[0].id, true);

    const detail = storage.getSeriesDetail(id);

    expect(
      detail?.seasons[0].episodes.map((episode) => episode.status)
    ).toEqual(['watched', 'unwatched']);
  });

  it('answers the first episode as next for a show nobody has started', () => {
    const storage = freshStorage();
    const detail = storage.getSeriesDetail(seedHarbor(storage));

    expect(tag(detail?.next ?? null)).toBe('S01E01');
    expect(detail?.seasons.map((season) => tag(season.next))).toEqual([
      'S01E01',
      'S02E01',
    ]);
  });

  it('answers the series’ next episode across a season boundary', () => {
    const storage = freshStorage();
    const id = seedHarbor(storage);
    const [s1e1, s1e2, s2e1] = storage.listEpisodes(id);
    for (const episode of [s1e1, s1e2, s2e1]) {
      storage.setEpisodeWatched(episode.id, true);
    }

    expect(tag(storage.getSeriesDetail(id)?.next ?? null)).toBe('S02E02');
  });

  it('answers each season’s own next episode', () => {
    const storage = freshStorage();
    const id = seedHarbor(storage);
    const [s1e1, s1e2, s2e1] = storage.listEpisodes(id);
    for (const episode of [s1e1, s1e2, s2e1]) {
      storage.setEpisodeWatched(episode.id, true);
    }

    // Season 1 is finished, so its next is its first; season 2 picks up at E02.
    expect(
      storage.getSeriesDetail(id)?.seasons.map((season) => tag(season.next))
    ).toEqual(['S01E01', 'S02E02']);
  });

  it('answers the series watched once every episode is, and not before', () => {
    const storage = freshStorage();
    const id = seedHarbor(storage);
    const episodes = storage.listEpisodes(id);
    for (const episode of episodes.slice(0, -1)) {
      storage.setEpisodeWatched(episode.id, true);
    }

    expect(storage.getSeriesDetail(id)?.series.watched).toBe(false);

    storage.setEpisodeWatched(episodes[episodes.length - 1].id, true);

    const detail = storage.getSeriesDetail(id);
    expect(detail?.series.watched).toBe(true);
    expect(tag(detail?.next ?? null)).toBe('S01E01');
  });

  it('answers a series with no episodes as no seasons and no next episode', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Lighthouse Keepers' });

    expect(storage.getSeriesDetail(series.id)).toMatchObject({
      seasons: [],
      next: null,
    });
  });

  it('answers only the series asked for', () => {
    const storage = freshStorage();
    const id = seedHarbor(storage);
    const other = storage.addSeries({ title: 'Lighthouse Keepers' });
    storage.addEpisode(other.id, {
      season: 1,
      number: 1,
      videoPath: 'lighthouse/e1.mp4',
    });

    const detail = storage.getSeriesDetail(id);

    expect(detail?.series.title).toBe('Harbor & Vine');
    expect(
      detail?.seasons
        .flatMap((season) => season.episodes)
        .map((e) => e.seriesId)
    ).toEqual([id, id, id, id, id]);
  });

  it('answers null for an id it does not hold, a movie’s among them', () => {
    const storage = freshStorage();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    expect(storage.getSeriesDetail('no-such-series')).toBeNull();
    expect(storage.getSeriesDetail(movie.id)).toBeNull();
  });
});

describe('series read: getEpisodeRead', () => {
  it('answers an episode with no title as a null title', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);

    expect(storage.getEpisodeRead(ids.S01E01)?.episode.title).toBeNull();
  });

  it('answers the next episode in the season as its id, numbers and title', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);

    expect(storage.getEpisodeRead(ids.S01E01)?.next).toEqual({
      id: ids.S01E02,
      season: 1,
      number: 2,
      title: 'Low Tide',
    });
  });

  it('answers the first episode of the next season after a season’s last', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);

    expect(storage.getEpisodeRead(ids.S01E02)?.next).toEqual({
      id: ids.S02E01,
      season: 2,
      number: 1,
      title: 'The Return',
    });
  });

  it('answers the next episode the library holds, across a gap in the numbers', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);

    expect(storage.getEpisodeRead(ids.S02E01)?.next?.id).toBe(ids.S02E04);
  });

  it('answers the next episode whether or not the family has watched it', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);
    storage.setEpisodeWatched(ids.S01E02, true);

    expect(storage.getEpisodeRead(ids.S01E01)?.next?.id).toBe(ids.S01E02);
  });

  it('answers a null next after the show’s last episode', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);

    expect(storage.getEpisodeRead(ids.S02E04)?.next).toBeNull();
  });

  it('answers a null next title for a next episode with no title', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Lighthouse Keepers' });
    const first = storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: 'lighthouse/e1.mp4',
    });
    const second = storage.addEpisode(series.id, {
      season: 1,
      number: 2,
      videoPath: 'lighthouse/e2.mp4',
    });

    expect(storage.getEpisodeRead(first.id)?.next).toEqual({
      id: second.id,
      season: 1,
      number: 2,
      title: null,
    });
  });

  it('answers the next episode within its own series, never another show’s', () => {
    const storage = freshStorage();
    const ids = seedWithGap(storage);
    const other = storage.addSeries({ title: 'Aardvark Street' });
    storage.addEpisode(other.id, {
      season: 3,
      number: 1,
      videoPath: 'aardvark/s3e1.mp4',
    });

    expect(storage.getEpisodeRead(ids.S02E04)?.next).toBeNull();
  });

  it('answers null for an id it does not hold, a movie’s among them', () => {
    const storage = freshStorage();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    expect(storage.getEpisodeRead('no-such-episode')).toBeNull();
    expect(storage.getEpisodeRead(movie.id)).toBeNull();
  });
});
