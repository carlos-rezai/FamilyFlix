import { closeSync, openSync, readSync } from 'node:fs';

/** An ISO base media file box header: 8 bytes, or 16 when the size is 64-bit. */
const HEADER_BYTES = 8;
const LARGE_SIZE_BYTES = 8;

/** The largest `mvhd` there is — a version-1 header, fields and all. */
const MVHD_BYTES = 120;

/**
 * A 32-bit duration of all ones is the container saying it does not know, which
 * is not a film that runs for 49 days.
 */
const UNKNOWN_32 = 0xffffffff;

/** One box in the tree: what it is, where its payload starts, where it ends. */
interface Box {
  type: string;
  payload: number;
  end: number;
}

/**
 * Read the box header at `offset`, or `null` when there is not a whole one
 * there — a truncated file, or the end of the tree.
 */
function readBox(fd: number, offset: number, limit: number): Box | null {
  if (offset + HEADER_BYTES > limit) {
    return null;
  }

  const header = Buffer.alloc(HEADER_BYTES + LARGE_SIZE_BYTES);
  const read = readSync(fd, header, 0, header.length, offset);
  if (read < HEADER_BYTES) {
    return null;
  }

  const type = header.toString('latin1', 4, HEADER_BYTES);
  let size = header.readUInt32BE(0);
  let payload = offset + HEADER_BYTES;

  if (size === 1) {
    if (read < HEADER_BYTES + LARGE_SIZE_BYTES) {
      return null;
    }
    size = Number(header.readBigUInt64BE(HEADER_BYTES));
    payload = offset + HEADER_BYTES + LARGE_SIZE_BYTES;
  } else if (size === 0) {
    // The last box in the file, running to the end of it.
    size = limit - offset;
  }

  const end = offset + size;
  if (size < payload - offset || end > limit) {
    return null;
  }

  return { type, payload, end };
}

/** The first child of `type` directly inside the given span, if there is one. */
function findBox(
  fd: number,
  type: string,
  start: number,
  limit: number
): Box | null {
  for (let offset = start; offset < limit; ) {
    const box = readBox(fd, offset, limit);
    if (box === null) {
      return null;
    }
    if (box.type === type) {
      return box;
    }
    offset = box.end;
  }
  return null;
}

/** The movie header's timescale and duration, in its own units. */
function readMovieHeader(
  fd: number,
  mvhd: Box
): { timescale: number; duration: number } | null {
  const bytes = Buffer.alloc(MVHD_BYTES);
  const read = readSync(fd, bytes, 0, MVHD_BYTES, mvhd.payload);
  if (read < 20) {
    return null;
  }

  // A full box: one version byte, then three flag bytes, then the fields —
  // which are 32-bit in version 0 and 64-bit in version 1.
  const version = bytes.readUInt8(0);
  if (version === 0) {
    if (read < 20) {
      return null;
    }
    const duration = bytes.readUInt32BE(16);
    return {
      timescale: bytes.readUInt32BE(12),
      duration: duration === UNKNOWN_32 ? 0 : duration,
    };
  }
  if (version === 1) {
    if (read < 32) {
      return null;
    }
    return {
      timescale: bytes.readUInt32BE(20),
      duration: Number(bytes.readBigUInt64BE(24)),
    };
  }
  return null;
}

/**
 * How long the film in `file` runs, in seconds, read from the container's own
 * header — or `null` when the file will not say.
 *
 * This is the **Playback read**'s duration, and reading it here rather than
 * from the movie record is the rule the whole seeking design rests on:
 * `runtimeMinutes` is rounded metadata that a film is allowed to arrive
 * without, while the file is the film. The client never asks the media element
 * either, because `video.duration` is `NaN` on a live transcode and a rounded
 * lie on a remux.
 *
 * It parses the MP4 / ISO base media `moov` → `mvhd` box, which is what direct
 * play sends. Anything it cannot parse answers `null` rather than a guess — a
 * wrong duration is a scrubber that lies about where the film is.
 *
 * Every other container is answered by `probe`, behind the same `Playback`
 * interface, which is why this is reached only when there is no **Playback
 * component** to ask: `createPlayback` takes the probe's duration when there
 * was a probe and this when there was not. That is the machine with no FFmpeg
 * on it reading the one format it can parse unaided, which is the state the PRD
 * makes first-class.
 */
export function mediaDuration(file: string): number | null {
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return null;
  }

  try {
    // `Infinity` as the top-level limit: the tree is walked box by box, and a
    // header that runs past the end of the file fails its own read.
    const moov = findBox(fd, 'moov', 0, Number.MAX_SAFE_INTEGER);
    if (moov === null) {
      return null;
    }

    const mvhd = findBox(fd, 'mvhd', moov.payload, moov.end);
    if (mvhd === null) {
      return null;
    }

    const header = readMovieHeader(fd, mvhd);
    if (header === null || header.timescale <= 0 || header.duration <= 0) {
      return null;
    }

    return header.duration / header.timescale;
  } catch {
    // A file that stops mid-box, or one that is not this format at all.
    return null;
  } finally {
    closeSync(fd);
  }
}
