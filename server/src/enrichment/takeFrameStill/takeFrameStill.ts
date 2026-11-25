import { posix } from 'node:path';

import type { StoredVideo } from '@/types';
import type { Media } from '../../media/createMedia/createMedia';
import type {
  NoFrameReason,
  Playback,
} from '../../playback/createPlayback/createPlayback';

/** What became of one **Frame still** take. */
export type FrameStillTaken =
  | { kind: 'stored'; name: string; stored: string }
  | { kind: 'none'; reason: NoFrameReason }
  | { kind: 'unstored' };

/**
 * One **Frame still**, taken and stored: `playback.frame` asked of the
 * episode's own video, the picture written as `<stem>.frame.jpg` into the
 * **Series folder**'s season folder. The one place a Frame still is named,
 * shared by the **Sync** and the **Frame fill**. The Series folder is asked
 * for only once a picture is in hand, so a take that gets none reserves
 * nothing; a signal aborted as the picture comes answers `aborted`.
 */
export async function takeFrameStill(
  { playback, media }: { playback: Pick<Playback, 'frame'>; media: Media },
  episode: StoredVideo & { season: number },
  seriesFolder: () => string,
  signal: AbortSignal
): Promise<FrameStillTaken> {
  const outcome = await playback.frame(episode, signal);
  if (signal.aborted) return { kind: 'none', reason: 'aborted' };
  if (outcome.kind === 'none') return outcome;

  const stem = posix.basename(
    episode.videoPath,
    posix.extname(episode.videoPath)
  );
  const name = `${stem}.frame.jpg`;
  try {
    const stored = await media.storeNamed(
      seriesFolder(),
      name,
      outcome.picture,
      episode.season
    );
    return { kind: 'stored', name, stored };
  } catch {
    return { kind: 'unstored' };
  }
}
