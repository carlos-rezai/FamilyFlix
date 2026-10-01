/**
 * Pure: the **FFmpeg pin**'s refusal. `actual` is the SHA-256 the download
 * hashed to, `expected` the one the pin holds; a mismatch throws, naming both,
 * so the build log says what arrived and what was expected. Compared without
 * regard to case, since a hex digest means the same either way.
 *
 * Written with erasable types only, so `fetchFfmpeg.mjs` imports it directly
 * under Node's own type stripping.
 */
export function verifyDigest(actual: string, expected: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `The FFmpeg archive's SHA-256 is ${actual}, but the pin expects ${expected}. Nothing was extracted.`
    );
  }
}
