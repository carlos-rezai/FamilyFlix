import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';

import { isExtra } from '../../import-export/splitCollections/splitCollections';
import { episodeTag, type EpisodeTag } from '../episodeTag/episodeTag';
import { isVideoFilename } from '../fileKinds/fileKinds';

/**
 * One **Loose video** as a root lists it: its name, its **Companion files**'
 * names and its **Episode tag**, `null` for a film.
 */
export interface LooseFile {
  video: string;
  companions: string[];
  tag: EpisodeTag | null;
}

/** A root's top level: its Loose videos, and every entry it holds. */
export interface LooseRead {
  loose: LooseFile[];
  names: string[];
}

/** A name without its extension, its case kept. */
const stemOf = (name: string): string =>
  name.slice(0, name.length - extname(name).length);

/**
 * Read a **Library folder**'s top level for its **Loose videos**: each video
 * lying directly in the root, extras left out, with its **Companion files**
 * (a file that is not a video, named by the video's stem plus `.` or `-`,
 * case folded; a file two stems claim goes to the longest) and its **Episode
 * tag**. `names` is every entry in the root, files and folders alike, for
 * the clash rule. Names, never paths: the root is the caller's.
 */
export async function readLooseVideos(root: string): Promise<LooseRead> {
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries.map((entry) => entry.name);
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  const videos = files.filter(
    (name) => isVideoFilename(name) && !isExtra(name)
  );
  const companions = new Map<string, string[]>(
    videos.map((video) => [video, []])
  );
  for (const name of files) {
    if (isVideoFilename(name)) {
      continue;
    }
    const folded = name.toLowerCase();
    let owner: string | null = null;
    for (const video of videos) {
      const stem = stemOf(video).toLowerCase();
      const claims =
        folded.startsWith(`${stem}.`) || folded.startsWith(`${stem}-`);
      if (claims && (owner === null || stem.length > stemOf(owner).length)) {
        owner = video;
      }
    }
    if (owner !== null) {
      companions.get(owner)?.push(name);
    }
  }

  return {
    loose: videos.map((video) => ({
      video,
      companions: companions.get(video) ?? [],
      tag: episodeTag(video),
    })),
    names,
  };
}
