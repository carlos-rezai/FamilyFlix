import { describe, it, expect } from 'vitest';

import { formatBytes } from './formatBytes';

/**
 * 15 — Settings hub, Phase 4: "the Storage card" (issue #146).
 *
 * `formatBytes(bytes)` writes **Space used** the way the folder's own
 * Properties dialog in Explorer does: 1024-based, one decimal, in
 * `B · KB · MB · GB · TB`; `0 B` for zero, and whole bytes below the first
 * threshold. The card agrees with Explorer to the decimal, which is the whole
 * of what it is for.
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

describe('formatBytes — zero and bytes', () => {
  it('writes zero as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('writes bytes below 1024 as whole bytes', () => {
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });
});

describe('formatBytes — the four thresholds at 1024', () => {
  it('turns over to KB at 1024', () => {
    expect(formatBytes(KB)).toBe('1.0 KB');
  });

  it('turns over to MB at 1024 KB', () => {
    expect(formatBytes(MB)).toBe('1.0 MB');
    expect(formatBytes(MB - 1)).toMatch(/ KB$/);
  });

  it('turns over to GB at 1024 MB', () => {
    expect(formatBytes(GB)).toBe('1.0 GB');
    expect(formatBytes(GB - 1)).toMatch(/ MB$/);
  });

  it('turns over to TB at 1024 GB', () => {
    expect(formatBytes(TB)).toBe('1.0 TB');
    expect(formatBytes(TB - 1)).toMatch(/ GB$/);
  });

  it('stays in TB past the last threshold', () => {
    expect(formatBytes(2048 * TB)).toBe('2048.0 TB');
  });
});

describe('formatBytes — one decimal', () => {
  it('writes one decimal, and only one', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1_310_720)).toBe('1.3 MB');
    expect(formatBytes(1_300_234)).toBe('1.2 MB');
  });

  it('keeps the decimal on a round number', () => {
    expect(formatBytes(2 * GB)).toBe('2.0 GB');
  });

  it('writes 18.4 GB for its bytes — what Explorer says of the family folder', () => {
    expect(formatBytes(19_756_849_562)).toBe('18.4 GB');
  });
});
