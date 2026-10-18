import type { AudioTrack } from '@/types';

/**
 * Which of a file's offered **Audio tracks** the player opens on —
 * `preferredSubtitle`'s twin: the first track in the **Preferred audio
 * language**, compared without case; else the track the file marks default;
 * else the first. `null` for a file with no track to offer.
 *
 * The match is read off `language`, the English name the server gave the
 * tag, never the label — and a track with no language never matches. No
 * preference (a refused settings read) is no preference, not English.
 */
export function preferredAudio(
  tracks: AudioTrack[],
  language?: string
): AudioTrack | null {
  const spoken = language?.toLowerCase();
  const inLanguage = spoken
    ? tracks.find((track) => track.language?.toLowerCase() === spoken)
    : undefined;

  return (
    inLanguage ?? tracks.find((track) => track.fileDefault) ?? tracks[0] ?? null
  );
}
