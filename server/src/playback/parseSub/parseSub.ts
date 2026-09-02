import type { Cue } from '@/types';

/**
 * MicroDVD — what `.sub` means in the family folder — into a **Cue list**.
 *
 * It is the only one of the four not timed in seconds at all: its records are
 * `{start}{end}text` in **frames**, so reaching **Absolute position** is a
 * division the other three never make, and the rate divided by is carried in
 * the file as a leading `{1}{1}25` record.
 *
 * That makes the frame rate this parser's whole risk. Read the wrong one and
 * every cue is out by a ratio that grows across the film — half an hour in, a
 * 25fps file read as 23.976 is nearly a minute and a half late — so the rate is
 * taken from the file whenever the file states one.
 */
const RECORD = /^\{(-?\d+)\}\{(-?\d+)\}(.*)$/;

/**
 * The rate a file that never declares one is read at.
 *
 * A rate has to come from somewhere, and the film-standard one is the least
 * wrong guess. It is a decision rather than an accident of whatever the first
 * implementation reached for.
 */
const DEFAULT_FPS = 23.976;

/** Whether a record is the rate declaration rather than a line of the film. */
function declaredRate(start: string, end: string, text: string): number | null {
  if (start !== '1' || end !== '1' || !/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const rate = Number(text);
  return rate > 0 ? rate : null;
}

/**
 * The words, without the per-line control codes, with `|` read as the break it
 * is. `{y:i}` and `{c:$00ffff}` style a renderer that is not ours, and left in
 * they are drawn as words over the film.
 */
function spoken(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .split('|')
    .join('\n')
    .trim();
}

export function parseSub(source: string): Cue[] {
  const cues: Cue[] = [];
  let fps = DEFAULT_FPS;

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const record = RECORD.exec(raw.trim());
    if (record === null) {
      continue;
    }

    const [, start, end, body] = record;

    const rate = declaredRate(start, end, body);
    if (rate !== null) {
      fps = rate;
      continue;
    }

    const text = spoken(body);
    if (text === '') {
      continue;
    }

    cues.push({ start: Number(start) / fps, end: Number(end) / fps, text });
  }

  return cues;
}
