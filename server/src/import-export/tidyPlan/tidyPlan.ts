import { extname } from 'node:path';

import type { KeptLoose, Tidy, TidyPlan } from '@/types';
import type { LooseRead } from '../../media/readLooseVideos/readLooseVideos';
import { safeFilename } from '../../media/safeFilename/safeFilename';
import { titleGuess, yearInName } from '../titleKey/titleKey';

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

/** The sentence a clash keeps a video where it is with. */
const clashReason = (folder: string): string =>
  `A folder called “${folder}” is already here.`;

/**
 * A root's **Tidy plan** from its `readLooseVideos` read: each loose film a
 * `film` **Tidy** into its **Tidy folder name**, or, when the root already
 * holds that name (a file or a folder, case folded), kept where it is with
 * the clash sentence. A video `kept` answers true for (a **Held video** or a
 * **Left-out video**) is in neither list. Two videos with one folder name are
 * both offered. Tagged videos, the episodes, are left out for now.
 */
export function tidyPlan(
  path: string,
  read: LooseRead,
  kept: (video: string) => boolean
): TidyPlan {
  const taken = new Set(read.names.map((name) => name.toLowerCase()));
  const tidies: Tidy[] = [];
  const keptLoose: KeptLoose[] = [];

  for (const file of read.loose) {
    if (file.tag !== null || kept(file.video)) {
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
