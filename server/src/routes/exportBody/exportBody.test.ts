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
  name: 'familyflix-collection_08-10-2026',
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

  it('carries nothing the body said beyond the five fields', () => {
    const read = exportBody({ ...BODY, extra: 1 });

    expect(read.ok && Object.keys(read.value).sort()).toEqual([
      'destination',
      'format',
      'images',
      'name',
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

// 36 — Export name (issue #295).
//
// The body carries the typed **Export name** as `name`, read only as a string:
// what a folder may be called is the domain's rule (`exportNameRefusal`), not
// the body reader's, so a name Windows would refuse still reads, and nothing
// is trimmed on the way through.

describe('exportBody — the name', () => {
  it('carries the name as typed', () => {
    const read = exportBody({ ...BODY, name: 'Heat (1995) – kopia' });

    expect(read).toEqual({
      ok: true,
      value: { ...BODY, name: 'Heat (1995) – kopia' },
    });
  });

  it('trims nothing off the name', () => {
    const read = exportBody({ ...BODY, name: '  family  ' });

    expect(read.ok && read.value.name).toBe('  family  ');
  });

  it.each([
    ['an empty name', ''],
    ['a name with a slash', 'a/b'],
    ['a reserved name', 'con'],
  ])('leaves %s for the writer to refuse', (_, name) => {
    expect(exportBody({ ...BODY, name })).toEqual({
      ok: true,
      value: { ...BODY, name },
    });
  });

  it.each([
    ['no name', undefined],
    ['a numeric name', 42],
    ['a null name', null],
    ['an array name', ['family']],
  ])('refuses %s with one sentence', (_, name) => {
    const read = exportBody({ ...BODY, name });

    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(typeof read.error).toBe('string');
      expect(read.error.length).toBeGreaterThan(0);
    }
  });

  it('reads the name before the Include booleans, top to bottom as the dialog draws them', () => {
    const nameAlone = exportBody({ ...BODY, name: 42 });
    const both = exportBody({ ...BODY, name: 42, images: 'true' });

    expect(nameAlone.ok || both.ok).toBe(false);
    if (!nameAlone.ok && !both.ok) {
      expect(both.error).toBe(nameAlone.error);
    }
  });
});
