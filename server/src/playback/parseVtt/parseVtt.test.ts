// @vitest-environment node
//
// 10 — Video player, Phase 6: "subtitles" (issue #88).
//
// WebVTT. It looks like SubRip until it does not: a `WEBVTT` header, a full
// dot for the decimal point, an optional two-field timestamp with no hour, cue
// settings trailing the timing line, named cues, `NOTE` blocks, and inline tags
// the box has no way to draw.
//
// It gets its own parser for exactly those quirks, and produces the same **Cue
// list** shape as the other three — which is the whole reason the four exist
// separately rather than as one function with a format flag.

import { describe, expect, it } from 'vitest';

import { parseVtt } from './parseVtt';

const VTT = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:04.000',
  '— You can see the whole coast from up here.',
  '',
  '00:00:05.500 --> 00:00:08.250',
  'It was worth the walk.',
  'Every step of it.',
  '',
].join('\n');

describe('parseVtt', () => {
  it('reads each cue in absolute position seconds, past the WEBVTT header', () => {
    expect(parseVtt(VTT)).toEqual([
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

  it('reads a timestamp written without its hour field', () => {
    // WebVTT allows `mm:ss.ttt`. Read as if it were `hh:mm`, a line 90 seconds
    // in would land 90 minutes in — an hour and a half of desync from one
    // missing field.
    const cues = parseVtt(
      ['WEBVTT', '', '01:30.000 --> 01:33.000', 'Ninety seconds in.'].join('\n')
    );

    expect(cues).toEqual([{ start: 90, end: 93, text: 'Ninety seconds in.' }]);
  });

  it('ignores the cue settings trailing a timing line', () => {
    // `line:`, `align:` and friends position a native cue. We draw our own box,
    // so they are noise — but they must not stop the timing being read.
    const cues = parseVtt(
      [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:04.000 line:90% align:middle',
        'Positioned, and we do not care.',
      ].join('\n')
    );

    expect(cues).toEqual([
      { start: 1, end: 4, text: 'Positioned, and we do not care.' },
    ]);
  });

  it('drops a cue identifier rather than putting it on screen', () => {
    // A named cue carries its name on the line above the timing, where SubRip
    // carries a number. Neither is dialogue.
    const cues = parseVtt(
      [
        'WEBVTT',
        '',
        'intro-line',
        '00:00:01.000 --> 00:00:04.000',
        'The only line.',
      ].join('\n')
    );

    expect(cues).toEqual([{ start: 1, end: 4, text: 'The only line.' }]);
  });

  it('skips NOTE and STYLE blocks, which are not dialogue', () => {
    const cues = parseVtt(
      [
        'WEBVTT',
        '',
        'NOTE',
        'Translated by hand, 2019.',
        '',
        'STYLE',
        '::cue { color: yellow }',
        '',
        '00:00:01.000 --> 00:00:04.000',
        'The only line.',
      ].join('\n')
    );

    expect(cues).toEqual([{ start: 1, end: 4, text: 'The only line.' }]);
  });

  it('strips inline tags, leaving the words the box can draw', () => {
    // `<v Ana>` and `<i>` mean something to a native renderer. Ours draws text,
    // and markup left in would be read out literally over the film.
    const cues = parseVtt(
      [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:04.000',
        '<v Ana><i>You can see the coast.</i></v>',
      ].join('\n')
    );

    expect(cues).toEqual([
      { start: 1, end: 4, text: 'You can see the coast.' },
    ]);
  });

  it('reads a file authored on Windows, whose line endings are CRLF', () => {
    expect(parseVtt(VTT.replace(/\n/g, '\r\n'))).toEqual(parseVtt(VTT));
  });

  it('answers an empty cue list for a file that is not WebVTT at all', () => {
    expect(parseVtt('this is a poster, not a subtitle file')).toEqual([]);
  });

  it('answers an empty cue list for a header with no cues under it', () => {
    expect(parseVtt('WEBVTT\n\n')).toEqual([]);
  });
});
