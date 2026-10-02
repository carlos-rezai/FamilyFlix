// @vitest-environment node
//
// `zipEntries` is `fetchFfmpeg.mjs`'s zip reader, pure: the entries off the
// central directory, then one entry's bytes, stored or deflated. gyan.dev's
// archive is deflated, so that is the branch every real `electron:ffmpeg`
// takes — and the one `fetchFfmpeg`'s own suite, over a stored zip, never
// reaches. The archives here are written by hand, `fetchFfmpeg.test.ts`'
// `storedZip` extended with `deflateRawSync`.

import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { entryBytes, zipEntries } from './zipEntries';

const STORED = 0;
const DEFLATED = 8;

interface Written {
  name: string;
  data: Buffer;
  method: number;
}

/** A zip of the entries given, each stored or deflated as it says. */
function writeZip(entries: Written[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const { name, data, method } of entries) {
    const fileName = Buffer.from(name, 'utf8');
    const body = method === DEFLATED ? deflateRawSync(data) : data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, fileName, body);
    centrals.push(central, fileName);
    offset += local.length + fileName.length + body.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directory, end]);
}

/** The refusal a call throws, as text. */
function refusal(call: () => unknown): string {
  try {
    call();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

const LICENSE = Buffer.from('GNU GENERAL PUBLIC LICENSE\nVersion 3\n');
const FFMPEG = Buffer.from('MZ the ffmpeg stand-in '.repeat(64));

describe('zipEntries', () => {
  it('lists every entry off the central directory, in order', () => {
    const zip = writeZip([
      { name: 'build/LICENSE', data: LICENSE, method: STORED },
      { name: 'build/bin/ffmpeg.exe', data: FFMPEG, method: DEFLATED },
    ]);

    expect(zipEntries(zip).map(({ name, method }) => [name, method])).toEqual([
      ['build/LICENSE', STORED],
      ['build/bin/ffmpeg.exe', DEFLATED],
    ]);
  });

  it('refuses a buffer that is not a zip', () => {
    expect(
      refusal(() => zipEntries(Buffer.from('MZ not an archive at all')))
    ).toMatch(/not a zip/);
  });
});

describe('entryBytes', () => {
  it('reads a stored entry', () => {
    const zip = writeZip([
      { name: 'build/LICENSE', data: LICENSE, method: STORED },
    ]);
    const [entry] = zipEntries(zip);

    expect(entryBytes(zip, entry)).toEqual(LICENSE);
  });

  it('reads a deflated entry, as gyan.dev’s archive carries', () => {
    const zip = writeZip([
      { name: 'build/LICENSE', data: LICENSE, method: STORED },
      { name: 'build/bin/ffmpeg.exe', data: FFMPEG, method: DEFLATED },
    ]);
    const entry = zipEntries(zip)[1];

    expect(entry.compressedSize).toBeLessThan(FFMPEG.length);
    expect(entryBytes(zip, entry)).toEqual(FFMPEG);
  });

  it('refuses an entry whose local header is damaged, naming it', () => {
    const zip = writeZip([
      { name: 'build/bin/ffmpeg.exe', data: FFMPEG, method: DEFLATED },
    ]);
    const [entry] = zipEntries(zip);
    zip.writeUInt32LE(0, entry.localOffset);

    const message = refusal(() => entryBytes(zip, entry));

    expect(message).toContain('build/bin/ffmpeg.exe');
    expect(message).toMatch(/damaged/);
  });

  it('refuses an entry in a method it cannot read, naming it and the method', () => {
    const zip = writeZip([
      { name: 'build/bin/ffprobe.exe', data: FFMPEG, method: 14 },
    ]);
    const [entry] = zipEntries(zip);

    const message = refusal(() => entryBytes(zip, entry));

    expect(message).toContain('build/bin/ffprobe.exe');
    expect(message).toContain('14');
  });
});
