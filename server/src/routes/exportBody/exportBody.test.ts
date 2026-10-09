// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// `exportBody(body)` — `POST /api/export`'s body read into a typed
// `StartExport`, or the sentence a `400` says: `enrichmentBody`'s precedent,
// a pure function answering the refusal rather than sending it. Whether the
// destination is absolute, there and writable is `writeExport`'s to say; the
// body reader asks only that it is a string.

import { describe, expect, it } from 'vitest';

import type { StartExport } from '@/types';
import { exportBody } from './exportBody';

const BODY: StartExport = {
  format: 'csv',
  destination: 'E:\\Movies',
  images: false,
  subtitles: false,
};

describe('exportBody — what it reads', () => {
  it('reads a csv export', () => {
    expect(exportBody(BODY)).toEqual({ ok: true, value: BODY });
  });

  it('reads an xlsx export with both options on', () => {
    const body = { ...BODY, format: 'xlsx', images: true, subtitles: true };

    expect(exportBody(body)).toEqual({ ok: true, value: body });
  });

  it('carries nothing the body said beyond the four fields', () => {
    const read = exportBody({ ...BODY, extra: 1 });

    expect(read.ok && Object.keys(read.value).sort()).toEqual([
      'destination',
      'format',
      'images',
      'subtitles',
    ]);
  });

  it('leaves a relative destination for the writer to refuse', () => {
    expect(exportBody({ ...BODY, destination: 'Movies' })).toEqual({
      ok: true,
      value: { ...BODY, destination: 'Movies' },
    });
  });
});

describe('exportBody — each malformed body is a 400 sentence', () => {
  it.each([
    ['no body', undefined],
    ['a null body', null],
    ['a string body', 'csv'],
    ['an array body', [BODY]],
    ['an unknown format', { ...BODY, format: 'pdf' }],
    ['a format in upper case', { ...BODY, format: 'CSV' }],
    ['no format', { ...BODY, format: undefined }],
    ['no destination', { ...BODY, destination: undefined }],
    ['a numeric destination', { ...BODY, destination: 42 }],
    ['no images', { ...BODY, images: undefined }],
    ['a string images', { ...BODY, images: 'true' }],
    ['no subtitles', { ...BODY, subtitles: undefined }],
    ['a numeric subtitles', { ...BODY, subtitles: 1 }],
  ])('refuses %s with one sentence', (_, body) => {
    const read = exportBody(body);

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(typeof read.error).toBe('string');
      expect(read.error.length).toBeGreaterThan(0);
    }
  });

  it('words an unknown format and a missing destination differently', () => {
    const format = exportBody({ ...BODY, format: 'pdf' });
    const destination = exportBody({ ...BODY, destination: undefined });

    expect(format.ok || destination.ok).toBe(false);
    if (!format.ok && !destination.ok) {
      expect(format.error).not.toBe(destination.error);
    }
  });
});
