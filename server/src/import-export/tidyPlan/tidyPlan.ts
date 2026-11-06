import { extname } from 'node:path';

import type { KeptLoose, Tidy, TidyPlan } from '@/types';
import type { LooseRead } from '../../media/readLooseVideos/readLooseVideos';
import { textBeforeTag } from '../../media/episodeTag/episodeTag';
import { safeFilename } from '../../media/safeFilename/safeFilename';
import { titleGuess, titleKey, yearInName } from '../titleKey/titleKey';

/** A name without its extension, its case kept. */
const stemOf = (name: string): string =>
  name.slice(0, name.length - extname(name).length);

/**
 * The **Tidy folder name** a film's video takes: the title and year its stem
 * names, `Apex (2026)`, or the title alone, made safe to join to the root.
 */
const folderNameOf = (video: string): string => {
  const stem = stemOf(video);
  const title = titleGuess(stem);
  const year = yearInName(stem);
  return safeFilename(year === null ? title : `${title} (${year})`);
};

/** The sentence an episode naming no show is kept where it is with. */
export const UNTITLED_REASON = "Doesn't name its show, left where it is.";

/** The sentence a clash keeps a video where it is with. */
const clashReason = (folder: string): string =>
  `A folder called “${folder}” is already here.`;

/**
 * A root's **Tidy plan** from its `readLooseVideos` read: each loose film a
 * `film` **Tidy** into its **Tidy folder name**, or, when the root already
 * holds that name (a file or a folder, case folded), kept where it is with
 * the clash sentence. A video `kept` answers true for (a **Held video** or a
 * **Left-out video**) is in neither list. Two videos with one folder name are
 * both offered.
 *
 * Tagged videos, the episodes, are never films: those whose text before the
 * tag shares a **Title key** make one `show` Tidy, named by `titleGuess` of
 * that text through `safeFilename`, the episodes kept flat. An episode with
 * nothing before the tag is kept where it is, with no folder.
 */
export function tidyPlan(
  path: string,
  read: LooseRead,
  kept: (video: string) => boolean
): TidyPlan {
  const taken = new Set(read.names.map((name) => name.toLowerCase()));
  const tidies: Tidy[] = [];
  const keptLoose: KeptLoose[] = [];
  const shows = new Map<string, Tidy>();

  for (const file of read.loose) {
    if (kept(file.video)) {
      continue;
    }
    if (file.tag !== null) {
      const before = textBeforeTag(file.video);
      const key = titleKey(before);
      if (key === '') {
        keptLoose.push({
          files: [file.video, ...file.companions],
          reason: UNTITLED_REASON,
        });
        continue;
      }
      const show = shows.get(key);
      if (show !== undefined) {
        show.videos.push(file.video);
        show.companions.push(...file.companions);
        continue;
      }
      const tidy: Tidy = {
        id: file.video.toLowerCase(),
        kind: 'show',
        folder: safeFilename(titleGuess(before)),
        videos: [file.video],
        companions: [...file.companions],
      };
      shows.set(key, tidy);
      tidies.push(tidy);
      continue;
    }
    const folder = folderNameOf(file.video);
    if (taken.has(folder.toLowerCase())) {
      keptLoose.push({
        files: [file.video, ...file.companions],
        reason: clashReason(folder),
        folder,
      });
      continue;
    }
    tidies.push({
      id: file.video.toLowerCase(),
      kind: 'film',
      folder,
      videos: [file.video],
      companions: file.companions,
    });
  }

  return { path, tidies, kept: keptLoose };
}
