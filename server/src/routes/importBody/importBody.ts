import {
  IMPORT_MODES,
  SHEET_FIELDS,
  type ImportMode,
  type SheetChoices,
  type SheetField,
} from '@/types';
import type { BodyRead } from '../enrichmentBody/enrichmentBody';

/**
 * _Apply choices_' body on a `differs` **Problem** → its **SheetChoices**:
 * `choices` a map of each **Sheet field** to `mine` or `sheet`. A field never
 * in play and a side that is neither are each refused in a sentence naming
 * it. Which fields the Problem holds is the domain's to say.
 */
export function sheetChoicesBody(body: unknown): BodyRead<SheetChoices> {
  const { choices } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as { choices?: unknown };
  if (
    typeof choices !== 'object' ||
    choices === null ||
    Array.isArray(choices)
  ) {
    return {
      ok: false,
      error: 'Choices must be a map of each field to mine or sheet.',
    };
  }
  const value: SheetChoices = {};
  for (const [field, side] of Object.entries(choices)) {
    if (!SHEET_FIELDS.includes(field as SheetField)) {
      return {
        ok: false,
        error: `The spreadsheet cannot change the field ${field}.`,
      };
    }
    if (side !== 'mine' && side !== 'sheet') {
      return {
        ok: false,
        error: `The choice for ${field} must be mine or sheet.`,
      };
    }
    value[field as SheetField] = side;
  }
  return { ok: true, value };
}

/**
 * A **Folder picker** press's body → the **Candidate folder** pressed:
 * `folder` a non-empty string, refused in a sentence otherwise. Whether it is
 * one of the Problem's candidates is the domain's to say.
 */
export function pickFolderBody(body: unknown): BodyRead<string> {
  const { folder } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as { folder?: unknown };
  if (typeof folder !== 'string' || folder.trim() === '') {
    return { ok: false, error: 'Folder must be the path of a candidate.' };
  }
  return { ok: true, value: folder };
}

/**
 * A **Folder scan**'s body → `{ enrich, mode }`: `enrich` true only when it is
 * `true`, and `mode` one of **IMPORT_MODES**, a missing or unknown one refused
 * in a sentence.
 */
export function folderScanBody(
  body: unknown
): BodyRead<{ enrich: boolean; mode: ImportMode }> {
  const { enrich, mode } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as { enrich?: unknown; mode?: unknown };
  if (!IMPORT_MODES.includes(mode as ImportMode)) {
    return { ok: false, error: 'Mode must be link or copy.' };
  }
  return {
    ok: true,
    value: { enrich: enrich === true, mode: mode as ImportMode },
  };
}
