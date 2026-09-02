// @vitest-environment node
//
// 10 — Video player, Phase 6: "subtitles" (issue #88).
//
// Advanced SubStation Alpha, the format that looks least like the other three:
// an INI-ish file of sections, where the lines that matter are `Dialogue:` rows
// under `[Events]`, and the column order those rows are in is declared by a
// `Format:` line rather than fixed.
//
// Its quirks are the ones most likely to put words on screen that are not
// dialogue: styling override tags in braces, `\N` for a hard break, `Comment:`
// rows that sit in the same table as the dialogue, and a text column that is
// allowed to contain the very comma the row is split on.

import { describe, expect, it } from 'vitest';

import { parseAss } from './parseAss';

const ASS = [
  '[Script Info]',
  'Title: Northwind',
  'ScriptType: v4.00+',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize',
  'Style: Default,Arial,20',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,— You can see the whole coast from up here.',
  'Dialogue: 0,0:00:05.50,0:00:08.25,Default,,0,0,0,,It was worth the walk.\\NEvery step of it.',
  '',
].join('\n');

describe('parseAss', () => {
  it('reads each Dialogue row as one cue, in absolute position seconds', () => {
    expect(parseAss(ASS)).toEqual([
      {
        start: 1,
        end: 4,
        text: '— You can see the whole coast from up here.',
      },
      {
        start: 5.5,
        end: 8.25,
        text: 'It was worth the walk.\nEvery step of it.',
      },
    ]);
  });

  it('reads the centisecond timestamp, whose hour field has no leading zero', () => {
    // `1:02:03.40` — one hour, not one minute, and `.40` is four tenths rather
    // than forty of anything.
    const cues = parseAss(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,1:02:03.40,1:02:05.00,Default,,0,0,0,,Late in the film.',
      ].join('\n')
    );

    expect(cues).toEqual([
      { start: 3723.4, end: 3725, text: 'Late in the film.' },
    ]);
  });

  it('takes the column order from the Format line rather than assuming one', () => {
    // The header is allowed to declare a different order, and a parser that
    // counted commas instead of reading it would time every cue off a margin.
    const cues = parseAss(
      [
        '[Events]',
        'Format: Start, End, Style, Text',
        'Dialogue: 0:00:01.00,0:00:04.00,Default,The only line.',
      ].join('\n')
    );

    expect(cues).toEqual([{ start: 1, end: 4, text: 'The only line.' }]);
  });

  it('keeps every comma in the text column, which is the last one', () => {
    // The text field is the last column precisely so it may contain commas.
    // Splitting the whole row on `,` truncates a line at its first comma.
    const cues = parseAss(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Well, yes, all of it.',
      ].join('\n')
    );

    expect(cues).toEqual([{ start: 1, end: 4, text: 'Well, yes, all of it.' }]);
  });

  it('strips the override tags, which style a renderer that is not ours', () => {
    const cues = parseAss(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,{\\i1\\pos(400,570)}You can see the coast.{\\i0}',
      ].join('\n')
    );

    expect(cues).toEqual([
      { start: 1, end: 4, text: 'You can see the coast.' },
    ]);
  });

  it('reads \\N as the line break it is', () => {
    const [, second] = parseAss(ASS);

    expect(second.text).toBe('It was worth the walk.\nEvery step of it.');
  });

  it('ignores Comment rows, which sit in the same table but are not dialogue', () => {
    const cues = parseAss(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Comment: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,A note to the translator.',
        'Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,The only line.',
      ].join('\n')
    );

    expect(cues).toEqual([{ start: 5, end: 8, text: 'The only line.' }]);
  });

  it('ignores the Style rows above, whose lines are also comma-separated', () => {
    // `[V4+ Styles]` has its own `Format:` line and its own rows. A parser that
    // read every section's table would emit a font name as a subtitle.
    expect(parseAss(ASS).map((cue) => cue.text)).not.toContain('Arial');
  });

  it('reads a file authored on Windows, whose line endings are CRLF', () => {
    expect(parseAss(ASS.replace(/\n/g, '\r\n'))).toEqual(parseAss(ASS));
  });

  it('answers an empty cue list for a file with no Events section', () => {
    expect(parseAss('[Script Info]\nTitle: Northwind\n')).toEqual([]);
  });

  it('answers an empty cue list for a file that is not SubStation at all', () => {
    expect(parseAss('this is a poster, not a subtitle file')).toEqual([]);
  });
});
