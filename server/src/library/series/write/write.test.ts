// @vitest-environment node
//
// Series write — `addSeries` and `addEpisode` through `LibraryStorage` over a
// real `:memory:` database: the two inserts the importer writes a show
// through, read back through the series reads.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

describe('series write: addSeries', () => {
  it('answers the assembled series, its genres in the order given', () => {
    const storage = freshStorage();

    const series = storage.addSeries({
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      genres: ['Drama', 'Comedy'],
    });

    expect(series).toMatchObject({
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      isFavorite: false,
      watched: false,
    });
    expect(series.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
    expect(storage.getSeriesDetail(series.id)?.series).toEqual(series);
  });

  it('refuses a genre the pool does not hold, and commits nothing', () => {
    const storage = freshStorage();

    expect(() =>
      storage.addSeries({ title: 'Harbor & Vine', genres: ['Drama', 'Nope'] })
    ).toThrow();

    expect(storage.getSeriesHome().series).toEqual([]);
  });
});

describe('series write: addEpisode', () => {
  it('answers the episode unwatched at zero, never watched', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    const episode = storage.addEpisode(series.id, {
      season: 1,
      number: 3,
      title: 'Low Tide',
      videoPath: 'harbor-vine/season-01/S01E03.mp4',
    });

    expect(episode).toMatchObject({
      seriesId: series.id,
      season: 1,
      number: 3,
      title: 'Low Tide',
      watched: false,
      resumePositionSeconds: 0,
      status: 'unwatched',
      lastWatchedAt: null,
      videoPath: 'harbor-vine/season-01/S01E03.mp4',
      subtitles: [],
    });
  });

  it('writes its subtitle tracks with it, in the order given', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: 'harbor-vine/season-01/S01E01.mp4',
      subtitles: [
        { path: 'harbor-vine/season-01/S01E01.en.srt', language: 'en' },
        { path: 'harbor-vine/season-01/S01E01.fa.srt', language: 'fa' },
      ],
    });

    const [episode] = storage.listEpisodes(series.id);
    expect(
      episode.subtitles.map(({ path, language }) => ({ path, language }))
    ).toEqual([
      { path: 'harbor-vine/season-01/S01E01.en.srt', language: 'en' },
      { path: 'harbor-vine/season-01/S01E01.fa.srt', language: 'fa' },
    ]);
  });

  it('refuses a second episode at one series, season and number', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });
    const input = {
      season: 1,
      number: 1,
      videoPath: 'harbor-vine/season-01/S01E01.mp4',
    };
    storage.addEpisode(series.id, input);

    expect(() =>
      storage.addEpisode(series.id, { ...input, videoPath: 'other.mp4' })
    ).toThrow(/UNIQUE/);

    expect(storage.listEpisodes(series.id)).toHaveLength(1);
  });

  it('takes the same number under another season, or another series', () => {
    const storage = freshStorage();
    const harbor = storage.addSeries({ title: 'Harbor & Vine' });
    const lighthouse = storage.addSeries({ title: 'Lighthouse Keepers' });

    storage.addEpisode(harbor.id, { season: 1, number: 1, videoPath: 'a.mp4' });
    storage.addEpisode(harbor.id, { season: 2, number: 1, videoPath: 'b.mp4' });
    storage.addEpisode(lighthouse.id, {
      season: 1,
      number: 1,
      videoPath: 'c.mp4',
    });

    expect(storage.listEpisodes(harbor.id)).toHaveLength(2);
    expect(storage.listEpisodes(lighthouse.id)).toHaveLength(1);
  });
});
