import type { Media } from '../../media/createMedia/createMedia';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../../media/fileKinds/fileKinds';
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
  const counting = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 1;
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
  resolveFolder: ResolveFolder
): { onFile: OnFilePart; uploads: EpisodeUploads } {
  const uploads: EpisodeUploads = { folder: null, episodes: [] };
  /** The episode fields a video part has already arrived for. */
  const videoArrived = new Set<number>();

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
 * the held path — whether that video is fresh bytes, and its tracks, the held
 * ones first and then each picked one with its language.
 */
export interface EditedEpisode extends EpisodeField {
  video: string;
  freshVideo: boolean;
  tracks: NewSubtitle[];
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
 * {@link readSeriesFields} for the **Series edit job**: an episode's video is
 * the part that landed or, without one, the held `videoPath` it names; its
 * tracks are its held ones and then those picked. Whether each `id` is the
 * series' own is the route's to ask — it holds the library.
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
      tracks: [
        ...(episode.storedSubtitles ?? []),
        ...picked.map((path, track) => ({
          path,
          language: episode.subtitleLanguages[track],
        })),
      ],
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
