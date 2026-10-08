/**
 * The **Title guess** — what a **Movie form** fills an empty title with from
 * the first video picked. The client's prefill counterpart of the importer's
 * `titleGuess`: the extension goes, dots and underscores read as spaces, and
 * everything from the first year, quality tag or **Episode tag** onward is
 * dropped. A prefill, never a write — the form decides whether to use it.
 */
import { describe, expect, it } from 'vitest';

import { titleFromFilename } from './titleFromFilename';

describe('titleFromFilename — the Title guess off a picked video', () => {
  it('reads The.Long.Fare.2019.1080p.mkv as “The Long Fare”', () => {
    // The phase's own example, whole: release-style dots, a year, a quality
    // tag and an extension in one name.
    expect(titleFromFilename('The.Long.Fare.2019.1080p.mkv')).toBe(
      'The Long Fare'
    );
  });

  it.each([
    ['release-style dots', 'The.Lantern.Keeper.mp4', 'The Lantern Keeper'],
    ['underscores', 'The_Lantern_Keeper.mp4', 'The Lantern Keeper'],
    ['spaces already', 'The Lantern Keeper.mp4', 'The Lantern Keeper'],
  ])('reads %s as spaces', (_, filename, title) => {
    expect(titleFromFilename(filename)).toBe(title);
  });

  it.each([
    ['a bare year', 'Rear Window 1954.mp4'],
    ['a dotted year', 'Rear.Window.1954.mp4'],
    ['a year in parentheses', 'Rear Window (1954).mp4'],
    ['a year in brackets', 'Rear Window [1954].mkv'],
    ['a year with more after it', 'Rear.Window.1954.Criterion.Remaster.mkv'],
  ])('drops everything from %s onward', (_, filename) => {
    expect(titleFromFilename(filename)).toBe('Rear Window');
  });

  it.each([
    ['1080p', 'Rear.Window.1080p.mkv'],
    ['720p', 'Rear_Window_720p.mp4'],
    ['2160p', 'Rear Window 2160p.mkv'],
    ['4K', 'Rear Window 4K.mkv'],
    ['a quality tag with more after it', 'Rear.Window.1080p.BluRay.x264.mkv'],
  ])('drops everything from a quality tag onward — %s', (_, filename) => {
    expect(titleFromFilename(filename)).toBe('Rear Window');
  });

  it.each([
    ['S01E03', 'Breaking.Bad.S01E03.Pilot.mkv'],
    ['a lower-case s01e03', 'Breaking_Bad_s01e03.mkv'],
    ['1x03', 'Breaking Bad 1x03 - Pilot.mkv'],
  ])('drops everything from an Episode tag onward — %s', (_, filename) => {
    // For an episode the guess is the text before the tag: the show's name,
    // which is what the series kind's empty title wants.
    expect(titleFromFilename(filename)).toBe('Breaking Bad');
  });

  it('reads a name with no extension', () => {
    expect(titleFromFilename('Rear Window')).toBe('Rear Window');
    expect(titleFromFilename('Rear Window (1954)')).toBe('Rear Window');
  });

  it('keeps the case, the accents and the punctuation the name has', () => {
    expect(titleFromFilename('Amélie.2001.mkv')).toBe('Amélie');
    expect(titleFromFilename("Ocean's.Eleven.2001.mp4")).toBe("Ocean's Eleven");
    expect(titleFromFilename('Spider-Man.2002.mkv')).toBe('Spider-Man');
  });

  it('keeps a number that is part of the title', () => {
    expect(titleFromFilename("Ocean's 11.mp4")).toBe("Ocean's 11");
    expect(titleFromFilename('Se7en.1995.avi')).toBe('Se7en');
  });

  it('collapses runs of separators and trims the ends', () => {
    expect(titleFromFilename('_The..Long__Fare_.mkv')).toBe('The Long Fare');
  });
});
