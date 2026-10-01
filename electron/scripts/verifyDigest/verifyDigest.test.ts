// @vitest-environment node
//
// Issue #231 — FFmpeg on board. `electron:ffmpeg` downloads the archive the
// **FFmpeg pin** names and refuses it when its SHA-256 is not the pin's.
// `verifyDigest` is that refusal, pure: the digest the download hashed to
// against the one the pin holds. A match passes; a mismatch throws, naming
// both, so the build log says what arrived and what was expected.

import { describe, expect, it } from 'vitest';

import { verifyDigest } from './verifyDigest';

const PINNED =
  '3f1c2b0a9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a';
const OTHER =
  '0000000000000000000000000000000000000000000000000000000000000001';

describe('verifyDigest', () => {
  it('passes a digest that matches the pin', () => {
    expect(() => verifyDigest(PINNED, PINNED)).not.toThrow();
  });

  it('refuses a digest that does not match the pin', () => {
    expect(() => verifyDigest(OTHER, PINNED)).toThrow();
  });

  it('names both digests in the refusal', () => {
    let message = '';
    try {
      verifyDigest(OTHER, PINNED);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(OTHER);
    expect(message).toContain(PINNED);
  });
});
