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

/**
 * One `episode` field of a series body, read: its numbers, its title, and the
 * languages its `episodeSubtitle` parts are paired with by order.
 */
export interface EpisodeField {
  season: number;
  number: number;
  title?: string;
  subtitleLanguages: string[];
}

/**
 * One episode's bytes, as they landed: the k-th entry belongs to the k-th
 * `episode` field. Each slot is taken when its part arrives and filled when
 * its bytes land, so two writes in flight cannot swap places.
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
  episodes: EpisodeUpload[];
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
  const { season, number, title, subtitleLanguages } = value as Record<
    string,
    unknown
  >;
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
  return {
    season,
    number,
    ...(typeof title === 'string' && title.trim() !== ''
      ? { title: title.trim() }
      : {}),
    subtitleLanguages: languages as string[],
  };
}

/**
 * The file half of a series body. The k-th `episodeVideo` belongs to the k-th
 * `episode` field, so a video arriving when the count of episode fields is not
 * one past the videos already seen is out of order; each `episodeSubtitle`
 * pairs with the latest episode's `subtitleLanguages`, and one beyond them is
 * stray. A refused part is drained and remembered, never thrown over.
 */
export function collectEpisodeUploads(
  media: Media,
  resolveFolder: ResolveFolder
): { onFile: OnFilePart; uploads: EpisodeUploads } {
  const uploads: EpisodeUploads = { folder: null, episodes: [] };

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
      if (episodeFields.length !== uploads.episodes.length + 1) {
        refuse('Each episode must be followed by its video');
        return;
      }
      const field = readEpisodeField(episodeFields[episodeFields.length - 1]);
      if (field === null) {
        refuse('Invalid episode field');
        return;
      }
      const upload: EpisodeUpload = { subtitles: [] };
      uploads.episodes.push(upload);
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
      const upload = uploads.episodes.at(-1);
      const field =
        upload === undefined || episodeFields.length !== uploads.episodes.length
          ? null
          : readEpisodeField(episodeFields[episodeFields.length - 1]);
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

/** The fields of a series body, coerced into the shapes `addSeries` takes. */
export interface SeriesFormValues {
  title: string;
  year?: number;
  endYear?: number;
  creator?: string;
  synopsis?: string;
  rating?: number;
  cast: string[];
  genres: string[];
  episodes: EpisodeField[];
}

export type SeriesFormRead =
  | ({ ok: true } & SeriesFormValues)
  | ({ ok: false } & Refusal);

/**
 * Read the fields of a series body, having already read its parts — the
 * refusals as sentences, the missing title first, as the movie's are.
 */
export function readSeriesFields(
  fields: Record<string, string[]>,
  uploads: EpisodeUploads,
  pool: ReadonlySet<string>
): SeriesFormRead {
  const refuse = (error: string): SeriesFormRead => ({
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

  if (uploads.refused !== undefined) {
    return refuse(uploads.refused);
  }

  for (const [index, episode] of episodes.entries()) {
    const upload = uploads.episodes[index];
    if (upload?.video === undefined) {
      return refuse(
        `Episode ${spellEpisodeTag(episode.season, episode.number)} has no video`
      );
    }
    if (upload.subtitles.length !== episode.subtitleLanguages.length) {
      return refuse(
        `Episode ${spellEpisodeTag(episode.season, episode.number)} is missing a subtitle`
      );
    }
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
    ...(span?.endYear == null ? {} : { endYear: span.endYear }),
    creator: optionalText(onlyField(fields, 'creator')),
    synopsis: optionalText(onlyField(fields, 'description')),
    rating,
    cast: fields.cast ?? [],
    genres,
    episodes,
  };
}
