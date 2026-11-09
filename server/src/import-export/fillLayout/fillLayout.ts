import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { LogLine } from '@/types';
import type { StillSource } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import { episodeTag, spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import {
  isImageFilename,
  isSubtitleFilename,
} from '../../media/fileKinds/fileKinds';
import { spellSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';

/** One subtitle track FamilyFlix holds: its language and its **Stored path**. */
export interface HeldTrack {
  language: string;
  path: string;
}

/** One episode's held files: its **Still** with its **Still source**, its tracks. */
export interface HeldEpisodeFiles {
  number: number;
  still: string | null;
  stillSource: StillSource | null;
  subtitles: HeldTrack[];
}

/** One season's held files: its **Season poster** and its episodes'. */
export interface HeldSeasonFiles {
  number: number;
  poster: string | null;
  episodes: HeldEpisodeFiles[];
}

/**
 * Every file FamilyFlix holds for one title, each a **Stored path**, and its
 * **Title folder** relative to its **Library folder**: what the **Layout
 * fill** writes from.
 */
export interface HeldTitleFiles {
  folder: string;
  poster: string | null;
  backdrop: string | null;
  subtitles: HeldTrack[];
  seasons: HeldSeasonFiles[];
}

/** What a Layout fill came to: the absolute paths it wrote and its lines. */
export interface LayoutFillOutcome {
  written: string[];
  lines: LogLine[];
}

/** One file to write: the Stored path it is copied from and its name. */
interface Write {
  stored: string;
  name: string;
}

/** One folder of the Title folder, its path in segments under it. */
interface FolderPlan {
  at: string[];
  writes(existing: readonly string[]): Write[];
}

/** The Still sources whose Still is written; a **Frame still** never is. */
const WRITTEN_STILLS: ReadonlySet<StillSource> = new Set(['tmdb', 'picked']);

/** A filename's stem, case folded. */
const stemOf = (name: string): string =>
  name.slice(0, name.length - extname(name).length).toLowerCase();

/** The Images folder's art by role: none when an image already ends in it. */
function artWrites(
  roles: readonly [role: string, stored: string | null][],
  existing: readonly string[]
): Write[] {
  const images = existing.filter(isImageFilename).map(stemOf);
  return roles.flatMap(([role, stored]) =>
    stored === null || images.some((stem) => stem.endsWith(role))
      ? []
      : [{ stored, name: `${role}${extname(stored)}` }]
  );
}

/**
 * A Subtitles folder's tracks by language: none of a language already there;
 * the first of one `<Language>.<ext>`, the next `<Language> (2).<ext>`.
 */
function trackWrites(
  tracks: readonly HeldTrack[],
  existing: readonly string[]
): Write[] {
  const there = new Set(
    existing
      .filter(isSubtitleFilename)
      .map((name) =>
        detectSubtitleLanguage(
          `${stemOf(name).replace(/ \(\d+\)$/, '')}${extname(name)}`
        ).toLowerCase()
      )
  );
  const counts = new Map<string, number>();
  return tracks.flatMap((track) => {
    if (there.has(track.language.toLowerCase())) {
      return [];
    }
    const count = (counts.get(track.language) ?? 0) + 1;
    counts.set(track.language, count);
    const name = count === 1 ? track.language : `${track.language} (${count})`;
    return [{ stored: track.path, name: `${name}${extname(track.path)}` }];
  });
}

/** Every folder of the Title folder the Layout fill may write into. */
function folderPlans(title: HeldTitleFiles): FolderPlan[] {
  const plans: FolderPlan[] = [
    {
      at: ['Images'],
      writes: (existing) =>
        artWrites(
          [
            ['poster', title.poster],
            ['backdrop', title.backdrop],
          ],
          existing
        ),
    },
    {
      at: ['Subtitles'],
      writes: (existing) => trackWrites(title.subtitles, existing),
    },
  ];
  for (const season of title.seasons) {
    const folder = spellSeasonFolder(season.number);
    plans.push(
      {
        at: [folder, 'Images'],
        writes: (existing) => artWrites([['poster', season.poster]], existing),
      },
      {
        at: [folder, 'Images', 'Stills'],
        writes: (existing) => {
          const tags = new Set(
            existing.filter(isImageFilename).flatMap((name) => {
              const tag = episodeTag(name);
              return tag === null
                ? []
                : [spellEpisodeTag(tag.season, tag.episode)];
            })
          );
          return season.episodes.flatMap((episode) => {
            const tag = spellEpisodeTag(season.number, episode.number);
            return episode.still === null ||
              episode.stillSource === null ||
              !WRITTEN_STILLS.has(episode.stillSource) ||
              tags.has(tag)
              ? []
              : [
                  {
                    stored: episode.still,
                    name: `${tag}${extname(episode.still)}`,
                  },
                ];
          });
        },
      }
    );
    for (const episode of season.episodes) {
      plans.push({
        at: [
          folder,
          'Subtitles',
          spellEpisodeTag(season.number, episode.number),
        ],
        writes: (existing) => trackWrites(episode.subtitles, existing),
      });
    }
  }
  return plans;
}

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

/** A folder's names; none for a folder that is not there or not a folder. */
async function namesIn(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/** Whether a path is a directory. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Copy one stored file to `target`, creating exclusively. */
async function writeOne(
  media: Media,
  stored: string,
  target: string
): Promise<'written' | 'exists'> {
  const source = await media.readStored(stored);
  try {
    // `wx` creates or fails: a file already there is never opened for writing.
    await pipeline(source, createWriteStream(target, { flags: 'wx' }));
    return 'written';
  } catch (error) {
    source.destroy();
    if (errorCode(error) === 'EEXIST') {
      return 'exists';
    }
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

/**
 * The **Layout fill**: write into the **Title folder** `title.folder`, under
 * the **Library folder** `root`, every file FamilyFlix holds whose slot is
 * empty, each piped out of managed storage and created exclusively, so a
 * file already in its slot is never replaced. A poster or backdrop only when
 * no image in `Images/` already ends in that role; a **Still** only from
 * `tmdb` or `picked`, never a **Frame still**, and only when none of its
 * **Episode tag** is there; a track only when none of its language is there,
 * a second of one language as `<Language> (2)`.
 *
 * A folder it can't write costs one Warning line and never a throw; a Title
 * folder that is not there is one Warning line and nothing written.
 */
export async function fillLayout(
  media: Media,
  root: string,
  title: HeldTitleFiles
): Promise<LayoutFillOutcome> {
  const outcome: LayoutFillOutcome = { written: [], lines: [] };
  const titleDir = join(root, title.folder);
  if (!(await isDirectory(titleDir))) {
    outcome.lines.push({
      text: `⚠ ${title.folder} is not in ${root}, nothing written`,
      kind: 'warning',
    });
    return outcome;
  }
  for (const plan of folderPlans(title)) {
    const dir = join(titleDir, ...plan.at);
    const writes = plan.writes(await namesIn(dir));
    if (writes.length === 0) {
      continue;
    }
    try {
      await mkdir(dir, { recursive: true });
      for (const { stored, name } of writes) {
        const target = join(dir, name);
        if ((await writeOne(media, stored, target)) === 'written') {
          outcome.written.push(target);
          outcome.lines.push({ text: `↓ ${name}  →  ${target}`, kind: 'scan' });
        }
      }
    } catch {
      outcome.lines.push({
        text: `⚠ Could not write to ${dir}`,
        kind: 'warning',
      });
    }
  }
  return outcome;
}
