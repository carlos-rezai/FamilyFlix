// @vitest-environment node
//
// 10 — Video player, Phase 6: "subtitles" (issue #88).
//
// SubRip, the format the family folder holds most of. The parser's whole job is
// to stop being SubRip: what comes out is a **Cue list** in **Absolute
// position** seconds, indistinguishable from what the other three produce, so
// that nothing downstream of `parseSubtitle` ever asks what the file was.
//
// The quirks tested here are SubRip's own — comma decimals, the sequence number
// nobody downstream wants, CRLF from a Windows-authored file, and a blank line
// as the only record separator.

import { describe, expect, it } from 'vitest';

import { parseSrt } from './parseSrt';

/** Two records, spelled the way a real `.srt` off the family folder spells them. */
const SRT = [
  '1',
  '00:00:01,000 --> 00:00:04,000',
  '— You can see the whole coast from up here.',
  '',
  '2',
  '00:00:05,500 --> 00:00:08,250',
  'It was worth the walk.',
  'Every step of it.',
  '',
].join('\n');

describe('parseSrt', () => {
  it('reads each record as one cue, in absolute position seconds', () => {
    expect(parseSrt(SRT)).toEqual([
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

  it('reads the comma as the decimal point it is, not as a thousands mark', () => {
    // `00:00:05,500` is five and a half seconds. A parser that split on the
    // comma and dropped the tail would put every cue a fraction early, which is
    // the kind of wrong nobody notices until a line lands on the wrong face.
    const [, second] = parseSrt(SRT);

    expect(second.start).toBe(5.5);
  });

  it('carries the hours and minutes into the total, not just the seconds', () => {
    const cues = parseSrt(
      ['1', '01:02:03,400 --> 01:02:05,000', 'Late in the film.', ''].join('\n')
    );

    expect(cues).toEqual([
      { start: 3723.4, end: 3725, text: 'Late in the film.' },
    ]);
  });

  it('drops the sequence number, which is the file’s bookkeeping and not a line', () => {
    // The number is how SubRip counts its own records. A cue whose text began
    // "1" would put a digit on screen over the film.
    expect(parseSrt(SRT).map((cue) => cue.text)).not.toContain('1');
  });

  it('reads a file authored on Windows, whose line endings are CRLF', () => {
    expect(parseSrt(SRT.replace(/\n/g, '\r\n'))).toEqual(parseSrt(SRT));
  });

  it('keeps a multi-line record as one cue with the break inside it', () => {
    // Two lines under one timestamp are one thing said, drawn as two rows in
    // the box — not two cues that would replace each other in the same instant.
    const [, second] = parseSrt(SRT);

    expect(second.text).toBe('It was worth the walk.\nEvery step of it.');
  });

  it('survives a file that is missing its trailing blank line', () => {
    const truncated = SRT.trimEnd();

    expect(parseSrt(truncated)).toHaveLength(2);
  });

  it('skips a record whose timing line it cannot read, and keeps the rest', () => {
    // One mangled record is not a film without subtitles.
    const damaged = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      'The readable one.',
      '',
      '2',
      'not a timing line at all',
      'The unreadable one.',
      '',
    ].join('\n');

    expect(parseSrt(damaged)).toEqual([
      { start: 1, end: 4, text: 'The readable one.' },
    ]);
  });

  it('answers an empty cue list for a file that is not SubRip at all', () => {
    // The route turns this into a 200 with `[]`: the film plays on with no
    // subtitles, which is not the same as the film failing to play.
    expect(parseSrt('this is a poster, not a subtitle file')).toEqual([]);
  });

  it('answers an empty cue list for an empty file', () => {
    expect(parseSrt('')).toEqual([]);
  });
});
