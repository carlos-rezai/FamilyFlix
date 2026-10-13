import { SHEET_FIELDS, type SheetChoices, type SheetField } from '@/types';
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
