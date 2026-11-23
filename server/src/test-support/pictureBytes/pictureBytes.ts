/**
 * Real minimal picture headers, each giving a **Picture size**: the first
 * bytes of a PNG, a JPEG and the three kinds of WebP, enough for a header
 * read and no pixels. For the `pictureSize` suite and every suite that hands
 * the media domain a picture of a known size.
 */

const u16be = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];

const u16le = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];

const u24le = (value: number): number[] => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
];

const u32be = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const u32le = (value: number): number[] => [...u32be(value)].reverse();

const ascii = (text: string): number[] =>
  [...text].map((char) => char.charCodeAt(0));

/** A PNG: the signature, then its IHDR chunk (CRC zeroed). */
export function pngBytes(width: number, height: number): Buffer {
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...u32be(13),
    ...ascii('IHDR'),
    ...u32be(width),
    ...u32be(height),
    8, // bit depth
    2, // colour type: truecolour
    0,
    0,
    0,
    ...u32be(0), // CRC, which a header read does not check
  ]);
}

/**
 * A JPEG: SOI, a JFIF APP0 and a quantisation table to step over, then the
 * frame header (`SOF0`, or `SOF2` for a progressive one), then EOI.
 */
export function jpegBytes(
  width: number,
  height: number,
  marker: 0xc0 | 0xc2 = 0xc0
): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    // APP0 JFIF, 16 bytes long.
    0xff,
    0xe0,
    ...u16be(16),
    ...ascii('JFIF'),
    0,
    1,
    1,
    0,
    ...u16be(1),
    ...u16be(1),
    0,
    0,
    // DQT, 67 bytes long: one table of 64 ones.
    0xff,
    0xdb,
    ...u16be(67),
    0,
    ...new Array<number>(64).fill(1),
    // The frame header, 17 bytes long: precision, height, width, 3 components.
    0xff,
    marker,
    ...u16be(17),
    8,
    ...u16be(height),
    ...u16be(width),
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
    0xff,
    0xd9,
  ]);
}

/** A RIFF WebP container around one chunk. */
function webp(fourcc: string, chunk: number[]): Buffer {
  const body = [
    ...ascii('WEBP'),
    ...ascii(fourcc),
    ...u32le(chunk.length),
    ...chunk,
  ];
  return Buffer.from([...ascii('RIFF'), ...u32le(body.length), ...body]);
}

/** A lossy WebP: a `VP8 ` key frame's tag, start code and 14-bit sizes. */
export function webpVp8Bytes(width: number, height: number): Buffer {
  return webp('VP8 ', [
    0x10,
    0x02,
    0x00, // frame tag: a key frame
    0x9d,
    0x01,
    0x2a, // start code
    ...u16le(width & 0x3fff),
    ...u16le(height & 0x3fff),
  ]);
}

/** A lossless WebP: `VP8L`'s signature, then width-1 and height-1 in 14 bits each. */
export function webpVp8lBytes(width: number, height: number): Buffer {
  const bits = ((width - 1) | ((height - 1) << 14)) >>> 0;
  return webp('VP8L', [0x2f, ...u32le(bits), 0x00]);
}

/** An extended WebP: `VP8X`'s flags, then the canvas width-1 and height-1 in 24 bits each. */
export function webpVp8xBytes(width: number, height: number): Buffer {
  return webp('VP8X', [0, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)]);
}
