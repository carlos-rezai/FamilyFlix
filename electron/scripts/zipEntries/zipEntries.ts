import { inflateRawSync } from 'node:zlib';

/**
 * Pure: a zip read by hand, so `fetchFfmpeg.mjs` needs no dependency. The
 * entries come off the central directory; one entry's bytes come off its
 * local header, stored or deflated. Anything else is a refusal that names the
 * entry, thrown, because the script's one answer to a bad archive is to stop.
 *
 * Written with erasable types only, so `fetchFfmpeg.mjs` imports it directly
 * under Node's own type stripping — `verifyDigest`'s precedent.
 */

/** One entry, as the central directory lists it. */
export interface ZipEntry {
  name: string;
  /** 0 stored, 8 deflated; anything else is refused when read. */
  method: number;
  compressedSize: number;
  localOffset: number;
}

const END_OF_DIRECTORY = 0x06054b50;
const CENTRAL_HEADER = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/** The end-of-directory record is 22 bytes, and its comment at most 65 535. */
const END_LENGTH = 22;
const LONGEST_COMMENT = 65_535;

/** The zip's entries, off its central directory. */
export function zipEntries(zip: Buffer): ZipEntry[] {
  let end = -1;
  const earliest = Math.max(0, zip.length - END_LENGTH - LONGEST_COMMENT);
  for (let at = zip.length - END_LENGTH; at >= earliest; at--) {
    if (zip.readUInt32LE(at) === END_OF_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error('The archive is not a zip.');

  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const found: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== CENTRAL_HEADER) {
      throw new Error('The archive’s central directory is damaged.');
    }
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    found.push({
      name: zip.toString('utf8', at + 46, at + 46 + nameLength),
      method: zip.readUInt16LE(at + 10),
      compressedSize: zip.readUInt32LE(at + 20),
      localOffset: zip.readUInt32LE(at + 42),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return found;
}

/** One entry's bytes, stored or deflated. */
export function entryBytes(zip: Buffer, entry: ZipEntry): Buffer {
  const { name, method, compressedSize, localOffset } = entry;
  if (
    localOffset + 30 > zip.length ||
    zip.readUInt32LE(localOffset) !== LOCAL_HEADER
  ) {
    throw new Error(`The archive’s entry ${name} is damaged.`);
  }
  const start =
    localOffset +
    30 +
    zip.readUInt16LE(localOffset + 26) +
    zip.readUInt16LE(localOffset + 28);
  const data = zip.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`The archive’s entry ${name} uses method ${method}.`);
}
