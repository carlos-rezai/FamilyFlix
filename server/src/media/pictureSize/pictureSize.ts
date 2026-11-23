import type { ArtFormat } from '../../playback/fitArgs/fitArgs';

/** A picture's **Picture size**, in pixels. */
export interface PictureSize {
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const isPng = (bytes: Buffer): boolean =>
  bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE);

const isJpeg = (bytes: Buffer): boolean =>
  bytes.length >= 3 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[2] === 0xff;

const isWebp = (bytes: Buffer): boolean =>
  bytes.length >= 12 &&
  bytes.toString('ascii', 0, 4) === 'RIFF' &&
  bytes.toString('ascii', 8, 12) === 'WEBP';

/** The `ArtFormat` a picture's first bytes say it is, or `null` for another. */
export function pictureFormat(bytes: Buffer): ArtFormat | null {
  if (isPng(bytes)) return 'png';
  if (isJpeg(bytes)) return 'jpeg';
  if (isWebp(bytes)) return 'webp';
  return null;
}

/** A PNG's IHDR: the first chunk, right after the signature. */
function pngSize(bytes: Buffer): PictureSize | null {
  if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The JPEG markers with no length after them: TEM, RSTn, SOI. */
const standalone = (marker: number): boolean =>
  marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);

/** A start-of-frame marker: SOF0 to SOF15, less DHT, JPG and DAC. */
const startOfFrame = (marker: number): boolean =>
  marker >= 0xc0 &&
  marker <= 0xcf &&
  marker !== 0xc4 &&
  marker !== 0xc8 &&
  marker !== 0xcc;

/** A JPEG's frame header, stepping segment by segment from SOI. */
function jpegSize(bytes: Buffer): PictureSize | null {
  let at = 2;
  while (at + 1 < bytes.length) {
    if (bytes[at] !== 0xff) {
      return null;
    }
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1; // a fill byte
      continue;
    }
    if (standalone(marker)) {
      at += 2;
      continue;
    }
    // EOI, or SOS with no frame header before it: nothing to read.
    if (marker === 0xd9 || marker === 0xda || at + 3 >= bytes.length) {
      return null;
    }
    if (startOfFrame(marker)) {
      if (at + 9 > bytes.length) {
        return null;
      }
      return {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  return null;
}

/** A WebP's first chunk: `VP8 `, `VP8L` or `VP8X`. */
function webpSize(bytes: Buffer): PictureSize | null {
  if (bytes.length < 20) {
    return null;
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    if (
      bytes.length < 30 ||
      bytes[23] !== 0x9d ||
      bytes[24] !== 0x01 ||
      bytes[25] !== 0x2a
    ) {
      return null;
    }
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    if (bytes.length < 25 || bytes[20] !== 0x2f) {
      return null;
    }
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    if (bytes.length < 30) {
      return null;
    }
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  }
  return null;
}

/**
 * A picture's **Picture size**, read off its header: a JPEG's SOF marker, a
 * PNG's IHDR, a WebP's VP8, VP8L or VP8X chunk. A few KB and no ffprobe.
 * `null` for anything it cannot read, and such a picture is kept as given.
 */
export function pictureSize(bytes: Buffer): PictureSize | null {
  switch (pictureFormat(bytes)) {
    case 'png':
      return pngSize(bytes);
    case 'jpeg':
      return jpegSize(bytes);
    case 'webp':
      return webpSize(bytes);
    default:
      return null;
  }
}
