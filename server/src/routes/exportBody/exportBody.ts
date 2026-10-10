import { EXPORT_FORMATS, type ExportFormat, type StartExport } from '@/types';
import type { BodyRead } from '../enrichmentBody/enrichmentBody';

/**
 * `POST /api/export`'s body → a typed {@link StartExport}, or the sentence a
 * `400` says: an object, a known format, a destination and a name that are
 * strings, and the two _Include_ booleans — checked in that order, top to
 * bottom as the dialog draws them, so a body wrong in two ways earns the
 * first sentence. Whether the destination is absolute, there and writable,
 * and what a folder may be called, are `writeExport`'s to say. Nothing is
 * trimmed, and nothing beyond the five fields is carried.
 */
export function exportBody(body: unknown): BodyRead<StartExport> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be an object' };
  }
  const { format, destination, name, images, subtitles } = body as Record<
    string,
    unknown
  >;
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
    return { ok: false, error: 'Unknown export format' };
  }
  if (typeof destination !== 'string') {
    return { ok: false, error: 'Say where to save the export' };
  }
  if (typeof name !== 'string') {
    return { ok: false, error: 'Name the export folder' };
  }
  if (typeof images !== 'boolean' || typeof subtitles !== 'boolean') {
    return { ok: false, error: 'images and subtitles are booleans' };
  }
  return {
    ok: true,
    value: {
      format: format as ExportFormat,
      destination,
      name,
      images,
      subtitles,
    },
  };
}
