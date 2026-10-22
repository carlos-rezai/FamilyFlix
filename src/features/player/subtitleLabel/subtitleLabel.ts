import type { Subtitle } from '@/types';

/**
 * The **Subtitle label**: the Subtitle's language, with ` · Track N` after it
 * only when another row shares that language (case-insensitively), N its place
 * in track order (ascending `position`) from 1. Never the filename.
 */
export function subtitleLabel(
  subtitle: Subtitle,
  subtitles: Subtitle[]
): string {
  const language = subtitle.language.toLowerCase();
  const tied = subtitles.some(
    (other) =>
      other.id !== subtitle.id && other.language.toLowerCase() === language
  );
  if (!tied) return subtitle.language;

  const place =
    [...subtitles]
      .sort((a, b) => a.position - b.position)
      .findIndex((other) => other.id === subtitle.id) + 1;
  return `${subtitle.language} · Track ${place}`;
}
