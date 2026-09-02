// @vitest-environment node
//
// 10 — Video player, Phase 6: "subtitles" (issue #88).
//
// The seam the four parsers exist for. `parseSubtitle` is the last place in the
// app that knows a subtitle file has a format: it picks a parser from the
// extension and answers a **Cue list**, and nothing downstream — not the route,
// not `fetchSubtitleCues`, not `cueAt`, not the **Subtitle overlay** — ever asks
// again.
//
// So the test that matters most here is not that each extension reaches its own
// parser. It is that the same dialogue, written out in all four formats, comes
// back as one identical array: if a consumer could tell them apart, it would be
// because this function let a difference through.

import { describe, expect, it } from 'vitest';

import type { Cue } from '@/types';

import { parseSubtitle } from './parseSubtitle';

/** The same two lines of a film, in each of the four formats we accept. */
const SRT = [
  '1',
  '00:00:01,000 --> 00:00:04,000',
  '— You can see the whole coast from up here.',
  '',
  '2',
  '00:00:05,000 --> 00:00:08,000',
  'It was worth the walk.',
  '',
].join('\n');

const VTT = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:04.000',
  '— You can see the whole coast from up here.',
  '',
  '00:00:05.000 --> 00:00:08.000',
  'It was worth the walk.',
  '',
].join('\n');

const ASS = [
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,— You can see the whole coast from up here.',
  'Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,It was worth the walk.',
  '',
].join('\n');

const SUB = [
  '{1}{1}25',
  '{25}{100}— You can see the whole coast from up here.',
  '{125}{200}It was worth the walk.',
  '',
].join('\n');

/** What every one of the four is expected to become. */
const CUES: Cue[] = [
  { start: 1, end: 4, text: '— You can see the whole coast from up here.' },
  { start: 5, end: 8, text: 'It was worth the walk.' },
];

describe('parseSubtitle', () => {
  it('answers the same cue list for the same film however the file was written', () => {
    // The point of the whole slice, asserted in one line: four formats in, one
    // shape out, and nothing downstream with a reason to branch.
    expect(parseSubtitle('Northwind (2018)/en.srt', SRT)).toEqual(CUES);
    expect(parseSubtitle('Northwind (2018)/en.vtt', VTT)).toEqual(CUES);
    expect(parseSubtitle('Northwind (2018)/en.ass', ASS)).toEqual(CUES);
    expect(parseSubtitle('Northwind (2018)/en.sub', SUB)).toEqual(CUES);
  });

  it('dispatches on the extension rather than sniffing the contents', () => {
    // SubRip contents under a `.sub` name is a mislabelled file, and the answer
    // is no cues — not a guess. A parser chosen by sniffing would quietly make
    // the extension decorative, and the file names are what the maintainer
    // controls.
    expect(parseSubtitle('Northwind (2018)/en.sub', SRT)).toEqual([]);
  });

  it('accepts an extension however it is capitalised', () => {
    // Windows hands back `EN.SRT` as readily as `en.srt`, and the family folder
    // was not tidied first.
    expect(parseSubtitle('Northwind (2018)/EN.SRT', SRT)).toEqual(CUES);
  });

  it('reads the extension off the end, not off the first dot in the path', () => {
    expect(parseSubtitle('A Film (2016)/a.film.en.srt', SRT)).toEqual(CUES);
  });

  it('answers an empty cue list for an extension it does not know', () => {
    // The scanner only ever attaches the four, so this is a hand-edited row —
    // and the film plays on without subtitles rather than the route failing.
    expect(parseSubtitle('Northwind (2018)/en.txt', SRT)).toEqual([]);
  });

  it('answers an empty cue list for a path with no extension at all', () => {
    expect(parseSubtitle('Northwind (2018)/subtitles', SRT)).toEqual([]);
  });

  it('answers an empty cue list for a file whose contents it cannot read', () => {
    // A malformed `.ass` is the case the ACs name: no cues, and the route turns
    // that into a 200 with an empty list, so the film keeps playing.
    expect(
      parseSubtitle('Northwind (2018)/en.ass', 'not a subtitle file')
    ).toEqual([]);
  });
});
