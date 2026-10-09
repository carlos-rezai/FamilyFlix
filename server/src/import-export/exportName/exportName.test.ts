// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// The **Export name**: a date in, `familyflix-collection_DD-MM-YYYY` out — the
// one place the name is spelled, with the clock injected so a test can stand
// on any day. The date is the maintainer's own, read in local time, because
// the folder is named for the day they pressed the button on.

import { describe, expect, it } from 'vitest';

import { EXPORT_NAME_PREFIX } from '@/types';
import { exportName } from './exportName';

describe('exportName — the prefix', () => {
  it('spells the prefix once, in the shared types', () => {
    expect(EXPORT_NAME_PREFIX).toBe('familyflix-collection');
  });

  it('carries the prefix, then an underscore, then the date', () => {
    expect(exportName(new Date(2026, 9, 8, 12, 0))).toBe(
      'familyflix-collection_08-10-2026'
    );
  });
});

describe('exportName — the date', () => {
  it('zero-pads a single-digit day and month', () => {
    expect(exportName(new Date(2026, 0, 5, 12, 0))).toBe(
      'familyflix-collection_05-01-2026'
    );
  });

  it('leaves a two-digit day and month as they are', () => {
    expect(exportName(new Date(2025, 11, 31, 12, 0))).toBe(
      'familyflix-collection_31-12-2025'
    );
  });

  it('reads the local date, not the UTC one, just after midnight', () => {
    expect(exportName(new Date(2026, 2, 1, 0, 15))).toBe(
      'familyflix-collection_01-03-2026'
    );
  });

  it('reads the local date, not the UTC one, just before midnight', () => {
    expect(exportName(new Date(2026, 2, 1, 23, 45))).toBe(
      'familyflix-collection_01-03-2026'
    );
  });
});
