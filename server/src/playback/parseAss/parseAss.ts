import type { Cue } from '@/types';

/**
 * Advanced SubStation Alpha into a **Cue list**.
 *
 * The format that looks least like the other three: an INI-ish file of sections
 * where the lines that matter are `Dialogue:` rows under `[Events]`, in a column
 * order the section's own `Format:` line declares rather than fixes.
 *
 * Three of its quirks would otherwise put words on screen that are not
 * dialogue — the `[V4+ Styles]` table, whose rows are comma-separated too;
 * `Comment:` rows, which sit in the same table as the dialogue; and the brace
 * override tags that style a renderer which is not ours. The fourth is the one
 * that truncates a line rather than inventing one: the text column is last
 * precisely so it may contain the comma the row is split on.
 */
const TIMESTAMP = /^(\d+):(\d{2}):(\d{2})\.(\d{1,2})$/;

/** `h:mm:ss.cc`, as one number of seconds, or `null` when it is not one. */
function seconds(stamp: string): number | null {
  const parts = TIMESTAMP.exec(stamp.trim());
  if (parts === null) {
    return null;
  }

  const millis =
    Number(parts[1]) * 3_600_000 +
    Number(parts[2]) * 60_000 +
    Number(parts[3]) * 1000 +
    Number(parts[4].padEnd(2, '0')) * 10;
  return millis / 1000;
}

/**
 * A row split into exactly as many fields as the `Format:` line declared, the
 * last of which keeps every comma left in it.
 */
function columns(row: string, count: number): string[] {
  const fields: string[] = [];
  let rest = row;

  while (fields.length < count - 1) {
    const comma = rest.indexOf(',');
    if (comma === -1) {
      break;
    }
    fields.push(rest.slice(0, comma));
    rest = rest.slice(comma + 1);
  }
  fields.push(rest);

  return fields;
}

/** The words, without the override tags, with `\N` read as the break it is. */
function spoken(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[Nn]/g, '\n')
    .trim();
}

export function parseAss(source: string): Cue[] {
  const cues: Cue[] = [];
  let inEvents = false;
  let format: string[] | null = null;

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();

    if (/^\[.*\]$/.test(line)) {
      inEvents = line.toLowerCase() === '[events]';
      format = null;
      continue;
    }
    if (!inEvents) {
      continue;
    }
    if (/^format\s*:/i.test(line)) {
      format = line
        .slice(line.indexOf(':') + 1)
        .split(',')
        .map((name) => name.trim().toLowerCase());
      continue;
    }
    // `Comment:` rows are in this same table and are not dialogue.
    if (format === null || !/^dialogue\s*:/i.test(line)) {
      continue;
    }

    const fields = columns(line.slice(line.indexOf(':') + 1), format.length);
    const start = seconds(fields[format.indexOf('start')] ?? '');
    const end = seconds(fields[format.indexOf('end')] ?? '');
    const text = spoken(fields[format.indexOf('text')] ?? '');

    if (start === null || end === null || text === '') {
      continue;
    }

    cues.push({ start, end, text });
  }

  return cues;
}
