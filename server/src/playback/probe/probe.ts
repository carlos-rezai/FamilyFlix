import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

/**
 * What **ffprobe** says a file is — the whole of what the format policy is
 * allowed to know about a film.
 *
 * It is a **server-side type and stays in `playback/`**: nothing on the wire
 * carries it. What the client is told is the **Playback path** that was chosen
 * from it, which is a decision rather than a description.
 *
 * Both codecs are nullable because a stream is allowed to be absent — a film
 * with no audio track has nothing that could fail to decode, which is not the
 * same as having an audio track nothing can read.
 */
export interface MediaProbe {
  /** The container, normalized: `mp4`, `webm`, `matroska`, `avi`, … */
  container: string;
  videoCodec: string | null;
  audioCodec: string | null;
  /** How long the film runs, in seconds, or `0` when the file will not say. */
  durationSeconds: number;
}

/** How long ffprobe is given before it is treated as having answered nothing. */
const PROBE_TIMEOUT_MS = 15000;

/** ffprobe's JSON is small; this is a ceiling rather than an expectation. */
const PROBE_BUFFER_BYTES = 4 * 1024 * 1024;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * One name for the container, from the comma-separated list ffprobe answers
 * with — `mov,mp4,m4a,3gp,3g2,mj2` for an MP4, `matroska,webm` for both kinds
 * of Matroska.
 *
 * Those two share a demuxer and not a fate: Chromium reads WebM natively and
 * refuses Matroska, so the extension is what separates them. It is the one
 * question about a file the bytes cannot answer, which is why the file's name
 * is read here and nowhere else in the policy.
 */
function normalizeContainer(formatName: string, file: string): string {
  const names = formatName.split(',').map((name) => name.trim());

  if (names.includes('matroska') || names.includes('webm')) {
    return extname(file).toLowerCase() === '.webm' ? 'webm' : 'matroska';
  }
  if (names.includes('mp4')) {
    return 'mp4';
  }
  return names[0] ?? '';
}

/** The first stream of the given kind, if the file has one. */
function codecOf(streams: unknown[], kind: string): string | null {
  for (const entry of streams) {
    const stream = asRecord(entry);
    if (stream !== null && asString(stream.codec_type) === kind) {
      return asString(stream.codec_name);
    }
  }
  return null;
}

/**
 * Ask the **Playback component** what a file is.
 *
 * `null` is every way of not knowing — no ffprobe there, a file it will not
 * open, output that will not parse — and they are deliberately one answer: a
 * caller cannot act differently on them, and `choosePlaybackPath` reads a
 * missing probe as "decide from the name alone", which is the honest thing to
 * do with a file nothing could read.
 *
 * It is synchronous, like `mediaDuration` beside it, because both routes that
 * ask are answering a request that cannot proceed without the answer.
 */
export function probe(ffprobe: string, file: string): MediaProbe | null {
  const result = spawnSync(
    ffprobe,
    [
      '-hide_banner',
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      file,
    ],
    {
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: PROBE_BUFFER_BYTES,
      windowsHide: true,
    }
  );

  if (result.error !== undefined || result.status !== 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout) as unknown;
  } catch {
    return null;
  }

  const root = asRecord(parsed);
  const format = asRecord(root?.format);
  const formatName = asString(format?.format_name);
  if (format === null || formatName === null) {
    return null;
  }

  const rawStreams: unknown = root?.streams;
  const streams: unknown[] = Array.isArray(rawStreams) ? rawStreams : [];

  const duration = Number(asString(format.duration) ?? '');

  return {
    container: normalizeContainer(formatName, file),
    videoCodec: codecOf(streams, 'video'),
    audioCodec: codecOf(streams, 'audio'),
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
  };
}
