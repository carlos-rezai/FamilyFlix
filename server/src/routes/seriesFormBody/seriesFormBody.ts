import { basename, extname } from 'node:path';

import type { Media } from '../../media/createMedia/createMedia';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../../media/fileKinds/fileKinds';
import type { SeasonPosterEdit } from '../../library';
import { yearSpan } from '../../library/series/yearSpan/yearSpan';
import type { Refusal, ResolveFolder } from '../movieFormBody/movieFormBody';
import { onlyField } from '../onlyField/onlyField';
import {
  INVALID_RATING,
  optionalRating,
} from '../optionalRating/optionalRating';
import { optionalText } from '../optionalText/optionalText';
import type { OnFilePart } from '../readBody/readBody';
import type { NewSubtitle } from '@/types';

/**
 * One `episode` field of a series body, read: its numbers, its title, and the
 * languages its `episodeSubtitle` parts are paired with by order. An edit's
 * field may also carry the held episode's `id`, its held video as
 * `videoPath` (when no `episodeVideo` part follows) and its held tracks as
 * `storedSubtitles`.
 */
export interface EpisodeField {
  id?: string;
  season: number;
  number: number;
  title?: string;
  subtitleLanguages: string[];
  videoPath?: string;
  storedSubtitles?: NewSubtitle[];
}

/**
 * One episode's bytes, as they landed: the k-th entry belongs to the k-th
 * `episode` field, and is absent for a field no part followed. Each slot is
 * taken when its part arrives and filled when its bytes land, so two writes
 * in flight cannot swap places.
 */
export interface EpisodeUpload {
  video?: string;
  subtitles: (string | undefined)[];
}

/** What a series request put on disk, filled in as its parts arrive. */
export interface EpisodeUploads {
  /** The **Series folder** this request wrote into, or `null`. */
  folder: string | null;
  poster?: string;
  episodes: (EpisodeUpload | undefined)[];
  /**
   * Each picked **Season poster** as it landed: the k-th entry belongs to the
   * k-th `seasonPoster` field, and is absent for a field no part followed.
   */
  seasonPosters: (string | undefined)[];
  /**
   * The first part this route would not take — a file `fileKinds` refuses, a
   * stray part, or a part out of the contract's order — as its sentence. The
   * refusal is carried out on the whole body once it has been read.
   */
  refused?: string;
}

/** An `episode` field's JSON, or `null` for one that is not the contract's. */
export function readEpisodeField(text: string): EpisodeField | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const {
    id,
    season,
    number,
    title,
    subtitleLanguages,
    videoPath,
    storedSubtitles,
  } = value as Record<string, unknown>;
  // 0 is a number: a pilot, a season of specials.
  const counting = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0;
  if (!counting(season) || !counting(number)) {
    return null;
  }
  if (title !== undefined && title !== null && typeof title !== 'string') {
    return null;
  }
  const languages = subtitleLanguages ?? [];
  if (
    !Array.isArray(languages) ||
    !languages.every((language) => typeof language === 'string')
  ) {
    return null;
  }
  if (id !== undefined && (typeof id !== 'string' || id === '')) {
    return null;
  }
  if (
    videoPath !== undefined &&
    (typeof videoPath !== 'string' || videoPath === '')
  ) {
    return null;
  }
  const held = storedSubtitles ?? [];
  if (!Array.isArray(held) || !held.every(isStoredTrack)) {
    return null;
  }
  return {
    ...(id === undefined ? {} : { id }),
    season,
    number,
    ...(typeof title === 'string' && title.trim() !== ''
      ? { title: title.trim() }
      : {}),
    subtitleLanguages: languages as string[],
    ...(videoPath === undefined ? {} : { videoPath }),
    ...(storedSubtitles === undefined
      ? {}
      : {
          storedSubtitles: held.map(({ path, language }) => ({
            path,
            language,
          })),
        }),
  };
}

/**
 * One `seasonPoster` field of a series body: the season, and — for a held
 * poster sent back untouched — its `path`. A field with neither a path nor a
 * following `seasonPosterFile` part takes that season's poster away.
 */
export interface SeasonPosterField {
  season: number;
  path?: string;
}

/** A `seasonPoster` field's JSON, or `null` for one that is not the contract's. */
export function readSeasonPosterField(text: string): SeasonPosterField | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { season, path } = value as Record<string, unknown>;
  if (typeof season !== 'number' || !Number.isInteger(season) || season < 0) {
    return null;
  }
  if (path !== undefined && (typeof path !== 'string' || path === '')) {
    return null;
  }
  return path === undefined ? { season } : { season, path };
}

/** What a series body asks of one season's poster, read whole. */
export type SeasonPosterChange =
  | { season: number; kind: 'keep' }
  | { season: number; kind: 'picked'; file: string }
  | { season: number; kind: 'remove' };

/**
 * The `seasonPoster` fields of a body, paired with the files that landed for
 * them — a refusal for a field that is not the contract's or a season twice.
 */
export function readSeasonPosters(
  fields: Record<string, string[]>,
  uploads: EpisodeUploads
): { ok: true; changes: SeasonPosterChange[] } | ({ ok: false } & Refusal) {
  const changes: SeasonPosterChange[] = [];
  const seen = new Set<number>();
  for (const [index, text] of (fields.seasonPoster ?? []).entries()) {
    const field = readSeasonPosterField(text);
    if (field === null) {
      return {
        ok: false,
        status: 400,
        error: `Invalid season poster field: ${JSON.stringify(text)}`,
      };
    }
    if (seen.has(field.season)) {
      return {
        ok: false,
        status: 400,
        error: `Season poster sent twice: season ${field.season}`,
      };
    }
    seen.add(field.season);
    const file = uploads.seasonPosters[index];
    changes.push(
      file !== undefined
        ? { season: field.season, kind: 'picked', file }
        : field.path !== undefined
          ? { season: field.season, kind: 'keep' }
          : { season: field.season, kind: 'remove' }
    );
  }
  return { ok: true, changes };
}

/**
 * A body's Season poster changes → the edits a series save writes: a picked
 * file at the Stored path `stored` gives it, a removed one `null`, and a kept
 * one nothing. A new series holds no Season poster, so a `remove` on an add
 * takes away nothing — one mapping serves both routes.
 */
export function seasonPosterEdits(
  changes: readonly SeasonPosterChange[],
  stored: (path: string) => string
): SeasonPosterEdit[] {
  return changes.flatMap((change): SeasonPosterEdit[] =>
    change.kind === 'picked'
      ? [{ season: change.season, posterPath: stored(change.file) }]
      : change.kind === 'remove'
        ? [{ season: change.season, posterPath: null }]
        : []
  );
}

/** The name a picked Season poster is stored under: `S02-poster.jpg`. */
export const seasonPosterName = (season: number, extension: string): string =>
  `${spellEpisodeTag(season)}-poster${extension}`;

/**
 * The names a series edit stores a picked Season poster under, given the
 * Stored paths of the posters it holds: {@link seasonPosterName}'s when no
 * held poster has it, else that name numbered `-2`, `-3`… before the
 * extension — so a picked poster never lands on a held one's name, and a
 * rollback can never take the held file with it.
 */
export function seasonPosterNamer(
  heldPaths: readonly string[]
): (season: number, extension: string) => string {
  const held = new Set(heldPaths.map((path) => basename(path)));
  return (season, extension) => {
    const name = seasonPosterName(season, extension);
    let candidate = name;
    for (let n = 2; held.has(candidate); n += 1) {
      candidate = name.replace(/(\.[^.]*)?$/, `-${n}$1`);
    }
    return candidate;
  };
}

/** A held track as an edit sends it: `{ path, language }`, both strings. */
function isStoredTrack(track: unknown): track is NewSubtitle {
  if (typeof track !== 'object' || track === null) {
    return false;
  }
  const { path, language } = track as Record<string, unknown>;
  return (
    typeof path === 'string' && path !== '' && typeof language === 'string'
  );
}

/**
 * The file half of a series body. Each `episodeVideo` and `episodeSubtitle`
 * belongs to the latest `episode` field before it, so a video before any
 * episode, or a second video after one, is out of order; each subtitle pairs
 * with that episode's `subtitleLanguages`, and one beyond them is stray. A
 * refused part is drained and remembered, never thrown over.
 */
export function collectEpisodeUploads(
  media: Media,
  resolveFolder: ResolveFolder,
  nameSeasonPoster: (
    season: number,
    extension: string
  ) => string = seasonPosterName
): { onFile: OnFilePart; uploads: EpisodeUploads } {
  const uploads: EpisodeUploads = {
    folder: null,
    episodes: [],
    seasonPosters: [],
  };
  /** The episode fields a video part has already arrived for. */
  const videoArrived = new Set<number>();
  /** The `seasonPoster` fields a file part has already arrived for. */
  const seasonPosterArrived = new Set<number>();

  const onFile: OnFilePart = async (name, filename, part, before) => {
    const refuse = (sentence: string): void => {
      part.resume();
      uploads.refused ??= sentence;
    };
    if (uploads.refused !== undefined) {
      part.resume();
      return;
    }

    // Read synchronously, at arrival: `before` keeps filling as parts land.
    const episodeFields = before.episode ?? [];

    let target: { season: number; slot: (path: string) => void } | null = null;
    if (name === 'seasonPosterFile') {
      if (!isImageFilename(filename)) {
        refuse(`Not a season poster image: ${JSON.stringify(filename)}`);
        return;
      }
      const posterFields = before.seasonPoster ?? [];
      const index = posterFields.length - 1;
      if (index < 0 || seasonPosterArrived.has(index)) {
        refuse('Each season poster must follow its seasonPoster field');
        return;
      }
      const field = readSeasonPosterField(posterFields[index]);
      if (field === null || field.path !== undefined) {
        refuse('Invalid season poster field');
        return;
      }
      seasonPosterArrived.add(index);
      uploads.folder ??= resolveFolder(before);
      uploads.seasonPosters[index] = await media.storeUpload(
        uploads.folder,
        nameSeasonPoster(field.season, extname(filename).toLowerCase()),
        part
      );
      return;
    }
    if (name === 'poster') {
      if (!isImageFilename(filename)) {
        refuse(`Not a poster image: ${JSON.stringify(filename)}`);
        return;
      }
    } else if (name === 'episodeVideo') {
      if (!isVideoFilename(filename)) {
        refuse(`Not a video file: ${JSON.stringify(filename)}`);
        return;
      }
      const index = episodeFields.length - 1;
      if (index < 0 || videoArrived.has(index)) {
        refuse('Each episode must be followed by its video');
        return;
      }
      const field = readEpisodeField(episodeFields[index]);
      if (field === null) {
        refuse('Invalid episode field');
        return;
      }
      videoArrived.add(index);
      const upload = (uploads.episodes[index] ??= { subtitles: [] });
      target = {
        season: field.season,
        slot: (path) => {
          upload.video = path;
        },
      };
    } else if (name === 'episodeSubtitle') {
      if (!isSubtitleFilename(filename)) {
        refuse(`Not a subtitle file: ${JSON.stringify(filename)}`);
        return;
      }
      const latest = episodeFields.length - 1;
      const field = latest < 0 ? null : readEpisodeField(episodeFields[latest]);
      const upload =
        field === null
          ? undefined
          : (uploads.episodes[latest] ??= { subtitles: [] });
      if (
        upload === undefined ||
        field === null ||
        upload.subtitles.length >= field.subtitleLanguages.length
      ) {
        refuse('A subtitle arrived that no episode names a language for');
        return;
      }
      const index = upload.subtitles.push(undefined) - 1;
      target = {
        season: field.season,
        slot: (path) => {
          upload.subtitles[index] = path;
        },
      };
    } else {
      refuse(`Unexpected part: ${JSON.stringify(name)}`);
      return;
    }

    uploads.folder ??= resolveFolder(before);
    const folder =
      target === null
        ? uploads.folder
        : media.seasonFolder(uploads.folder, target.season);
    const stored = await media.storeUpload(folder, filename, part);
    if (target === null) {
      uploads.poster = stored;
    } else {
      target.slot(stored);
    }
  };

  return { onFile, uploads };
}

/**
 * One episode once its body has been read whole: its field, paired with the
 * paths its parts landed at — the video, and a track per language, in order.
 */
export interface LandedEpisode extends EpisodeField {
  video: string;
  subtitles: string[];
}

/**
 * One episode of an edit, read whole: its video — the part that landed, else
 * the held path — whether that video is fresh bytes, and its tracks kept
 * apart: the held ones its `storedSubtitles` named, and each picked one that
 * landed, with its language.
 */
export interface EditedEpisode extends EpisodeField {
  video: string;
  freshVideo: boolean;
  heldTracks: NewSubtitle[];
  pickedTracks: NewSubtitle[];
}

/** The series' own fields, coerced into the shapes the storage takes. */
export interface SeriesFields {
  title: string;
  year?: number;
  endYear?: number;
  creator?: string;
  synopsis?: string;
  rating?: number;
  cast: string[];
  genres: string[];
}

/** The fields of a series body, coerced into the shapes `addSeries` takes. */
export interface SeriesFormValues extends SeriesFields {
  episodes: LandedEpisode[];
}

export type SeriesFormRead =
  | ({ ok: true } & SeriesFormValues)
  | ({ ok: false } & Refusal);

/** The fields of a series edit's body, its episodes held or new. */
export type SeriesEditRead =
  | ({ ok: true } & SeriesFields & { episodes: EditedEpisode[] })
  | ({ ok: false } & Refusal);

/**
 * Read the fields of a series body, having already read its parts — the
 * refusals as sentences, the missing title first, as the movie's are. Each
 * episode is answered with the paths its checks proved landed, so the route
 * reads them off the episode it is handed.
 */
export function readSeriesFields(
  fields: Record<string, string[]>,
  uploads: EpisodeUploads,
  pool: ReadonlySet<string>
): SeriesFormRead {
  return readSeriesBody(fields, uploads, pool, (episode, upload, tag) => {
    if (upload?.video === undefined) {
      return `Episode ${tag} has no video`;
    }
    const subtitles = landedTracks(upload);
    if (subtitles.length !== episode.subtitleLanguages.length) {
      return `Episode ${tag} is missing a subtitle`;
    }
    return { ...episode, video: upload.video, subtitles };
  });
}

/**
 * {@link readSeriesFields} for the **Series edit job**, and for the **Series
 * Resolve**, whose body is the same: an episode's video is the part that
 * landed or, without one, the `videoPath` it names — a held **Stored path**
 * on an edit, a **Found file** on a Resolve; its held tracks and its picked
 * ones are answered apart. Whether each `id` is the series' own is the
 * route's to ask — it holds the library.
 */
export function readSeriesEditFields(
  fields: Record<string, string[]>,
  uploads: EpisodeUploads,
  pool: ReadonlySet<string>
): SeriesEditRead {
  return readSeriesBody(fields, uploads, pool, (episode, upload, tag) => {
    const video = upload?.video ?? episode.videoPath;
    if (video === undefined) {
      return `Episode ${tag} has no video`;
    }
    const picked = upload === undefined ? [] : landedTracks(upload);
    if (picked.length !== episode.subtitleLanguages.length) {
      return `Episode ${tag} is missing a subtitle`;
    }
    return {
      ...episode,
      video,
      freshVideo: upload?.video !== undefined,
      heldTracks: episode.storedSubtitles ?? [],
      pickedTracks: picked.map((path, track) => ({
        path,
        language: episode.subtitleLanguages[track],
      })),
    };
  });
}

/** The tracks of an upload whose bytes have landed, in order. */
const landedTracks = (upload: EpisodeUpload): string[] =>
  upload.subtitles.filter((path): path is string => path !== undefined);

/**
 * The one reading behind both: the title, the episode fields, a pair or an id
 * twice, a refused part, each episode as `land` reads it (a string is its
 * refusal), the rating, the genres — in that load-bearing order.
 */
function readSeriesBody<Episode>(
  fields: Record<string, string[]>,
  uploads: EpisodeUploads,
  pool: ReadonlySet<string>,
  land: (
    episode: EpisodeField,
    upload: EpisodeUpload | undefined,
    tag: string
  ) => Episode | string
):
  | ({ ok: true } & SeriesFields & { episodes: Episode[] })
  | ({ ok: false } & Refusal) {
  const refuse = (error: string): { ok: false } & Refusal => ({
    ok: false,
    status: 400,
    error,
  });

  const title = onlyField(fields, 'title')?.trim() ?? '';
  if (title === '') {
    return refuse('Body must carry a title');
  }

  const episodes: EpisodeField[] = [];
  for (const text of fields.episode ?? []) {
    const episode = readEpisodeField(text);
    if (episode === null) {
      return refuse(`Invalid episode field: ${JSON.stringify(text)}`);
    }
    episodes.push(episode);
  }
  if (episodes.length === 0) {
    return refuse('Body must carry at least one episode');
  }

  const seen = new Set<string>();
  for (const { season, number } of episodes) {
    const tag = spellEpisodeTag(season, number);
    if (seen.has(tag)) {
      return refuse(`Duplicate episode: ${tag}`);
    }
    seen.add(tag);
  }

  const ids = new Set<string>();
  for (const { id } of episodes) {
    if (id === undefined) continue;
    if (ids.has(id)) {
      return refuse(`Episode sent twice: ${id}`);
    }
    ids.add(id);
  }

  if (uploads.refused !== undefined) {
    return refuse(uploads.refused);
  }

  const landed: Episode[] = [];
  for (const [index, episode] of episodes.entries()) {
    const tag = spellEpisodeTag(episode.season, episode.number);
    const read = land(episode, uploads.episodes[index], tag);
    if (typeof read === 'string') {
      return refuse(read);
    }
    landed.push(read);
  }

  const postedRating = onlyField(fields, 'rating');
  const rating = optionalRating(postedRating);
  if (rating === INVALID_RATING) {
    return refuse(`Invalid rating: ${JSON.stringify(postedRating)}`);
  }

  const genres = fields.genre ?? [];
  const unknown = genres.find((name) => !pool.has(name));
  if (unknown !== undefined) {
    return refuse(`Unknown genre: ${unknown}`);
  }

  // An unreadable year is stored as no year, not refused.
  const span = yearSpan(onlyField(fields, 'year')?.trim() ?? '');

  return {
    ok: true,
    title,
    ...(span === null ? {} : { year: span.year }),
    ...(span === null || span.endYear === null
      ? {}
      : { endYear: span.endYear }),
    creator: optionalText(onlyField(fields, 'creator')),
    synopsis: optionalText(onlyField(fields, 'description')),
    rating,
    cast: fields.cast ?? [],
    genres,
    episodes: landed,
  };
}
