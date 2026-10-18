import type { AudioTrack } from '@/types';

/**
 * The first track spoken in `language`, compared without case — read off the
 * English name the server gave the tag, never the label, and a track with no
 * language never matching. No language matches nothing.
 */
function spokenIn(
  tracks: AudioTrack[],
  language: string | null | undefined
): AudioTrack | undefined {
  const spoken = language?.toLowerCase();
  return spoken
    ? tracks.find((track) => track.language?.toLowerCase() === spoken)
    : undefined;
}

/**
 * Which of a file's offered **Audio tracks** the player opens on —
 * `preferredSubtitle`'s twin: the **Audio choice** where a track speaks it;
 * else the first track in the **Preferred audio language**; else the track
 * the file marks default; else the first. `null` for a file with no track to
 * offer.
 *
 * A choice no track speaks falls to the preference, not to the file default:
 * an evening in Spanish reaching an episode with no Spanish opens in the
 * household's language. No preference (a refused settings read) is no
 * preference, not English; no choice is no choice.
 */
export function preferredAudio(
  tracks: AudioTrack[],
  language?: string,
  choice?: string | null
): AudioTrack | null {
  return (
    spokenIn(tracks, choice) ??
    spokenIn(tracks, language) ??
    tracks.find((track) => track.fileDefault) ??
    tracks[0] ??
    null
  );
}
