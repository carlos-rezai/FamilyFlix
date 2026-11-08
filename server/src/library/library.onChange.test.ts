// @vitest-environment node
//
// Log 58, Phase 7: "the Library sheet" (issue #540).
//
// `LibraryStorage.onChange(listener) => unsubscribe` calls its listener with
// the **Library folders** touched by every write that changes a cell of a
// **Library sheet**: an add, an edit, a delete, Clear details, a Sync, an
// import or a scan (the Source folder recorded), a rating, a heart, a Status
// crossing. A **Watch tick** that crosses no Status calls nothing.
//
// Real in-memory SQLite through the public seam; each write is made against
// a title recorded under folder A, and the test reads which folders the
// listener was handed.

import { describe, expect, it, vi } from 'vitest';

import type { LibraryStorage } from '.';
import { freshStorage } from '../test-support/freshStorage/freshStorage';
import { newMovie } from '../test-support/newMovie/newMovie';

/** A library with folder A listed, a film and a series recorded under it. */
function world() {
  const storage = freshStorage();
  const folder = storage.addLibraryFolder('E:\\Movies');
  const film = storage.addMovie(
    newMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'Heat (1995)/Heat.mkv',
      videoFolderId: folder.id,
    })
  );
  storage.setSourceFolder(film.id, folder.id, 'Heat (1995)');
  const series = storage.addSeries({ title: 'Harbor', year: 2020 }, [
    {
      season: 1,
      number: 1,
      videoPath: 'Harbor (2020)/Season 01/Harbor S01E01.mkv',
      videoFolderId: folder.id,
      sourceFile: 'Season 01/Harbor S01E01.mkv',
    },
  ]);
  storage.setSourceFolder(series.id, folder.id, 'Harbor (2020)');
  const episode = storage.listEpisodes(series.id)[0]!;
  return { storage, folderId: folder.id, film, series, episode };
}

/** Every folder id the listener was handed while `write` ran. */
function touchedBy(storage: LibraryStorage, write: () => void): string[] {
  const listener = vi.fn<(folderIds: string[]) => void>();
  const unsubscribe = storage.onChange(listener);
  try {
    write();
  } finally {
    unsubscribe();
  }
  return listener.mock.calls.flatMap(([folderIds]) => folderIds);
}

describe('LibraryStorage.onChange: a write that changes a sheet cell', () => {
  it('an add (the import and the scan recording its Source folder) touches its folder', () => {
    const { storage, folderId } = world();

    const touched = touchedBy(storage, () => {
      const added = storage.addMovie(
        newMovie({
          title: 'Ronin',
          year: 1998,
          videoPath: 'Ronin (1998)/Ronin.mkv',
          videoFolderId: folderId,
        })
      );
      storage.setSourceFolder(added.id, folderId, 'Ronin (1998)');
    });

    expect(touched).toContain(folderId);
  });

  it('a series add with its episodes touches its folder', () => {
    const { storage, folderId, series } = world();

    expect(
      touchedBy(storage, () =>
        storage.addEpisode(series.id, {
          season: 1,
          number: 2,
          videoPath: 'Harbor (2020)/Season 01/Harbor S01E02.mkv',
          videoFolderId: folderId,
          sourceFile: 'Season 01/Harbor S01E02.mkv',
        })
      )
    ).toContain(folderId);
  });

  it('a film edit touches its folder', () => {
    const { storage, folderId, film } = world();

    expect(
      touchedBy(storage, () =>
        storage.updateMovie(film.id, { synopsis: 'A heist.' })
      )
    ).toContain(folderId);
  });

  it('a series edit touches its folder', () => {
    const { storage, folderId, series, episode } = world();

    expect(
      touchedBy(storage, () =>
        storage.updateSeries(series.id, {
          title: 'Harbor',
          year: 2020,
          endYear: null,
          synopsis: 'A port town.',
          creator: null,
          cast: [],
          rating: null,
          genres: [],
          posterPath: null,
          episodes: [
            {
              id: episode.id,
              season: 1,
              number: 1,
              videoPath: episode.videoPath,
            },
          ],
        })
      )
    ).toContain(folderId);
  });

  it('a film delete and a series delete touch their folder', () => {
    const { storage, folderId, film, series } = world();

    expect(touchedBy(storage, () => storage.deleteMovie(film.id))).toContain(
      folderId
    );
    expect(touchedBy(storage, () => storage.deleteSeries(series.id))).toContain(
      folderId
    );
  });

  it('Clear details on a film and on a series touch their folder', () => {
    const { storage, folderId, film, series } = world();

    expect(
      touchedBy(storage, () => storage.clearMovieDetails(film.id))
    ).toContain(folderId);
    expect(
      touchedBy(storage, () => storage.clearSeriesDetails(series.id))
    ).toContain(folderId);
  });

  it('a Sync of a film, a series, an episode and a Season poster touches their folder', () => {
    const { storage, folderId, film, series, episode } = world();

    expect(
      touchedBy(storage, () =>
        storage.enrichMovie(film.id, { synopsis: 'A heist.' })
      )
    ).toContain(folderId);
    expect(
      touchedBy(storage, () =>
        storage.enrichSeries(series.id, { synopsis: 'A port town.' })
      )
    ).toContain(folderId);
    expect(
      touchedBy(storage, () =>
        storage.enrichEpisode(episode.id, { title: 'Arrivals' })
      )
    ).toContain(folderId);
    expect(
      touchedBy(storage, () =>
        storage.setSeasonPoster(series.id, 1, 'harbor/season-01.jpg')
      )
    ).toContain(folderId);
  });

  it('a rating on a film and on a series touches their folder', () => {
    const { storage, folderId, film, series } = world();

    expect(touchedBy(storage, () => storage.setRating(film.id, 8))).toContain(
      folderId
    );
    expect(
      touchedBy(storage, () => storage.setSeriesRating(series.id, 6))
    ).toContain(folderId);
  });

  it('a heart on a film and on a series touches their folder', () => {
    const { storage, folderId, film, series } = world();

    expect(
      touchedBy(storage, () => storage.setFavorite(film.id, true))
    ).toContain(folderId);
    expect(
      touchedBy(storage, () => storage.setSeriesFavorite(series.id, true))
    ).toContain(folderId);
  });

  it('a film crossing a Status touches its folder: started, finished, unwatched', () => {
    const { storage, folderId, film } = world();

    expect(
      touchedBy(storage, () => storage.setResumePosition(film.id, 30))
    ).toContain(folderId);
    expect(touchedBy(storage, () => storage.markWatched(film.id))).toContain(
      folderId
    );
    expect(touchedBy(storage, () => storage.markUnwatched(film.id))).toContain(
      folderId
    );
  });

  it('an episode, a season and a series crossing a Status touch their folder', () => {
    const { storage, folderId, series, episode } = world();

    expect(
      touchedBy(storage, () => storage.setEpisodeResumePosition(episode.id, 30))
    ).toContain(folderId);
    expect(
      touchedBy(storage, () => storage.setEpisodeWatched(episode.id, true))
    ).toContain(folderId);
    expect(
      touchedBy(storage, () => storage.setSeasonWatched(series.id, 1, false))
    ).toContain(folderId);
    expect(
      touchedBy(storage, () => storage.setSeriesWatched(series.id, true))
    ).toContain(folderId);
  });
});

describe('LibraryStorage.onChange: a Watch tick that crosses no Status', () => {
  it('calls nothing for a film already in progress', () => {
    const { storage, film } = world();
    storage.setResumePosition(film.id, 30);
    const listener = vi.fn();
    storage.onChange(listener);

    storage.setResumePosition(film.id, 60);

    expect(listener).not.toHaveBeenCalled();
  });

  it('calls nothing for an episode already in progress', () => {
    const { storage, episode } = world();
    storage.setEpisodeResumePosition(episode.id, 30);
    const listener = vi.fn();
    storage.onChange(listener);

    storage.setEpisodeResumePosition(episode.id, 60);

    expect(listener).not.toHaveBeenCalled();
  });

  it('calls nothing for a film already watched', () => {
    const { storage, film } = world();
    storage.markWatched(film.id);
    const listener = vi.fn();
    storage.onChange(listener);

    storage.setResumePosition(film.id, 30);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('LibraryStorage.onChange: unsubscribe', () => {
  it('stops calling a listener once it unsubscribes', () => {
    const { storage, film } = world();
    const listener = vi.fn();
    const unsubscribe = storage.onChange(listener);

    unsubscribe();
    storage.setRating(film.id, 8);

    expect(listener).not.toHaveBeenCalled();
  });
});
