// @vitest-environment node
//
// 10 — Video player, Phase 6: "subtitles" (issue #88).
//
// MicroDVD — what `.sub` means in the family folder, and the only one of the
// four that is not timed in seconds at all. Its records are `{start}{end}text`
// in **frames**, so turning it into a **Cue list** in **Absolute position**
// seconds is a division the other three never make, and the frame rate it is
// divided by is itself carried in the file: a leading `{1}{1}25` record.
//
// That makes the frame rate this parser's whole risk. Read the wrong one and
// every cue is out by a ratio that grows across the film — half an hour in, a
// 25fps file read as 23.976 is nearly a minute and a half late.

import { describe, expect, it } from 'vitest';

import { parseSub } from './parseSub';

/** A 25fps file: the rate record, then two lines of dialogue. */
const SUB = [
  '{1}{1}25',
  '{25}{100}— You can see the whole coast from up here.',
  '{125}{200}It was worth the walk.|Every step of it.',
  '',
].join('\n');

describe('parseSub', () => {
  it('turns frames into absolute position seconds at the file’s own rate', () => {
    expect(parseSub(SUB)).toEqual([
      {
        start: 1,
        end: 4,
        text: '— You can see the whole coast from up here.',
      },
      { start: 5, end: 8, text: 'It was worth the walk.\nEvery step of it.' },
    ]);
  });

  it('takes the frame rate from the file’s leading record, not from a constant', () => {
    // The same frame numbers, declared at a different rate, are different
    // seconds. A parser with a hard-coded rate would pass the test above and
    // still put every cue in the wrong place on half the family's files.
    const cues = parseSub(
      ['{1}{1}50', '{25}{100}— You can see the whole coast.'].join('\n')
    );

    expect(cues).toEqual([
      { start: 0.5, end: 2, text: '— You can see the whole coast.' },
    ]);
  });

  it('does not put the frame-rate record on screen as a subtitle', () => {
    // `{1}{1}25` is a record like any other to a parser that is not looking for
    // it, and "25" would flash over the first frame of the film.
    expect(parseSub(SUB).map((cue) => cue.text)).not.toContain('25');
  });

  it('falls back to 23.976 for a file that never declares a rate', () => {
    // A rate has to come from somewhere, and the film-standard one is the least
    // wrong guess. Recorded here so the fallback is a decision rather than an
    // accident of whatever the first implementation reached for.
    const cues = parseSub('{24}{48}The only line.');

    expect(cues[0].start).toBeCloseTo(24 / 23.976, 5);
    expect(cues[0].end).toBeCloseTo(48 / 23.976, 5);
  });

  it('reads the pipe as the line break it is', () => {
    const [, second] = parseSub(SUB);

    expect(second.text).toBe('It was worth the walk.\nEvery step of it.');
  });

  it('strips the per-line control codes, which style a renderer that is not ours', () => {
    // `{y:i}`, `{c:$00ffff}` and friends lead the text of a record. Left in,
    // they are drawn as words over the film.
    const cues = parseSub(
      ['{1}{1}25', '{25}{100}{y:i}{c:$00ffff}You can see the coast.'].join('\n')
    );

    expect(cues).toEqual([
      { start: 1, end: 4, text: 'You can see the coast.' },
    ]);
  });

  it('reads a file authored on Windows, whose line endings are CRLF', () => {
    expect(parseSub(SUB.replace(/\n/g, '\r\n'))).toEqual(parseSub(SUB));
  });

  it('skips a record it cannot read, and keeps the rest', () => {
    const damaged = [
      '{1}{1}25',
      '{25}{100}The readable one.',
      'not a record at all',
      '{125}{200}The other readable one.',
    ].join('\n');

    expect(parseSub(damaged).map((cue) => cue.text)).toEqual([
      'The readable one.',
      'The other readable one.',
    ]);
  });

  it('answers an empty cue list for a file that is not MicroDVD at all', () => {
    expect(parseSub('this is a poster, not a subtitle file')).toEqual([]);
  });

  it('answers an empty cue list for an empty file', () => {
    expect(parseSub('')).toEqual([]);
  });
});
