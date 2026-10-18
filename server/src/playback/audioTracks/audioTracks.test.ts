// @vitest-environment node
//
// 46 — Audio tracks, Phase 2: "the track on the wire" (issue #400).
//
// A probe and a per-index path decision → the **Audio tracks** the playback
// read offers, labelled. Pure: the path of each **Audio track index** arrives
// as a function, so what is asserted here is which tracks are offered and what
// each is called — never the format policy, which has its own suite.
//
// The server labels, so the client never sees a raw tag.

import { describe, expect, it } from 'vitest';

import type { PlaybackPath } from '@/types';

import type { MediaProbe, ProbedAudio } from '../probe/probe';

import { audioTracks } from './audioTracks';

function stream(partial: Partial<ProbedAudio> = {}): ProbedAudio {
  return {
    codec: 'aac',
    language: null,
    title: null,
    isDefault: false,
    ...partial,
  };
}

function probeWith(audioStreams: ProbedAudio[]): MediaProbe {
  return {
    container: 'matroska',
    videoCodec: 'h264',
    audioStreams,
    durationSeconds: 5391.2,
  };
}

/** Every index remuxes — the paths are not what a label test is about. */
const remuxEverywhere = (): PlaybackPath => 'remux';

function labels(streams: ProbedAudio[]): string[] {
  return audioTracks(probeWith(streams), remuxEverywhere).map((t) => t.label);
}

describe('audioTracks — each track’s label', () => {
  it('reads language and title as “language · title”', () => {
    expect(labels([stream({ language: 'eng', title: 'Commentary' })])).toEqual([
      'English · Commentary',
    ]);
  });

  it('shows a title that already names the language alone', () => {
    expect(labels([stream({ language: 'eng', title: 'English 5.1' })])).toEqual(
      ['English 5.1']
    );
  });

  it('reads the language alone when there is no title', () => {
    expect(labels([stream({ language: 'fre' })])).toEqual(['French']);
  });

  it('reads the title alone when there is no language', () => {
    expect(labels([stream({ title: 'Commentary' })])).toEqual(['Commentary']);
  });

  it('reads a language it cannot name as no language', () => {
    expect(labels([stream({ language: 'und', title: 'Commentary' })])).toEqual([
      'Commentary',
    ]);
  });

  it('calls a track with neither “Track N”, counting from 1', () => {
    expect(labels([stream({ language: 'eng' }), stream()])).toEqual([
      'English',
      'Track 2',
    ]);
  });

  it('suffixes each of two colliding labels with its track number', () => {
    expect(
      labels([
        stream({ language: 'eng' }),
        stream({ language: 'fre' }),
        stream({ language: 'eng' }),
      ])
    ).toEqual(['English · Track 1', 'French', 'English · Track 3']);
  });
});

describe('audioTracks — what each track carries', () => {
  it('carries its index, named language, file-default flag and own path', () => {
    const tracks = audioTracks(
      probeWith([
        stream({ language: 'eng', isDefault: true }),
        stream({ language: 'jpn', codec: 'ac3' }),
      ]),
      (index) => (index === 0 ? 'direct' : 'transcode')
    );

    expect(tracks).toEqual([
      {
        index: 0,
        language: 'English',
        label: 'English',
        fileDefault: true,
        path: 'direct',
      },
      {
        index: 1,
        language: 'Japanese',
        label: 'Japanese',
        fileDefault: false,
        path: 'transcode',
      },
    ]);
  });

  it('answers a null language for a tag it cannot name', () => {
    const [track] = audioTracks(
      probeWith([stream({ language: 'mul' })]),
      remuxEverywhere
    );

    expect(track?.language).toBeNull();
  });
});

describe('audioTracks — which tracks are offered', () => {
  it('drops a track whose path would be cannot-play, keeping the others’ indices', () => {
    const tracks = audioTracks(
      probeWith([
        stream({ language: 'eng' }),
        stream({ language: 'fre' }),
        stream({ language: 'ger' }),
      ]),
      (index) => (index === 1 ? 'cannot-play' : 'remux')
    );

    expect(tracks.map((t) => t.index)).toEqual([0, 2]);
    expect(tracks.map((t) => t.label)).toEqual(['English', 'German']);
  });

  it('offers nothing for a file nothing could probe', () => {
    expect(audioTracks(null, remuxEverywhere)).toEqual([]);
  });

  it('offers nothing for a file with no audio', () => {
    expect(audioTracks(probeWith([]), remuxEverywhere)).toEqual([]);
  });
});
