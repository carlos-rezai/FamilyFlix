import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { FoundFileChoice } from './FoundFileChoice';
import { theme } from '@/styles/theme';
import type { MovieFormFile } from '@/types';

/**
 * 38 — Title editing, Slice 7 (issue #310): the **Found-file choice**. A film
 * Resolve whose folder holds two or more videos draws them as a radio group
 * named _Video_: each video by its file name, the one in the slot checked, and
 * the picker kept beside them for a file from somewhere else. Moved here from
 * `MovieFormFiles`' suite when the choice took its own folder (issue #311).
 */
const FOLDER = 'E:\\Movies\\Paper Moons (2014)';
const FOUND: MovieFormFile[] = [
  'paper.moons.2014.1080p.mkv',
  'paper.moons.2014.extras.mkv',
].map((filename) => ({
  kind: 'found',
  path: `${FOLDER}\\${filename}`,
  filename,
}));

/** A film off the maintainer's own disk, as the browser hands it over. */
const LANTERN = new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' });

function renderChoice(video: MovieFormFile | null = FOUND[0]) {
  const onChoose = vi.fn<(video: MovieFormFile) => void>();
  const onPick = vi.fn<(file: File) => void>();
  render(
    <ThemeProvider theme={theme}>
      <FoundFileChoice
        videos={FOUND}
        video={video}
        onChoose={onChoose}
        onPick={onPick}
      />
    </ThemeProvider>
  );
  return { onChoose, onPick };
}

const option = (name: string) =>
  screen.getByRole('radio', { name }) as HTMLElement;
const picker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

describe('FoundFileChoice', () => {
  it('draws the folder’s videos as a radio group named Video, each by its file name', () => {
    renderChoice();

    expect(screen.getByRole('radiogroup', { name: 'Video' })).toBeTruthy();
    expect(
      screen.getAllByRole('radio').map((radio) => radio.textContent?.trim())
    ).toEqual(['paper.moons.2014.1080p.mkv', 'paper.moons.2014.extras.mkv']);
  });

  it('checks the video in the slot — the first, as the form preselects it', () => {
    renderChoice();

    expect(
      option('paper.moons.2014.1080p.mkv').getAttribute('aria-checked')
    ).toBe('true');
    expect(
      option('paper.moons.2014.extras.mkv').getAttribute('aria-checked')
    ).toBe('false');
  });

  it('checks whichever found video the slot holds', () => {
    renderChoice(FOUND[1]);

    expect(
      option('paper.moons.2014.extras.mkv').getAttribute('aria-checked')
    ).toBe('true');
    expect(
      option('paper.moons.2014.1080p.mkv').getAttribute('aria-checked')
    ).toBe('false');
  });

  it('reports the video chosen', () => {
    const { onChoose } = renderChoice();

    fireEvent.click(option('paper.moons.2014.extras.mkv'));

    expect(onChoose).toHaveBeenCalledWith(FOUND[1]);
  });

  it('keeps the picker beside the choice, for a film from somewhere else', async () => {
    const { onPick } = renderChoice();

    await userEvent.upload(picker(), LANTERN, { applyAccept: false });

    expect(onPick).toHaveBeenCalledWith(LANTERN);
  });

  it('draws a picked film as the group’s last row, chosen', () => {
    renderChoice({ kind: 'picked', file: LANTERN, filename: 'lantern.mp4' });

    const radios = screen.getAllByRole('radio');
    expect(radios.at(-1)?.textContent?.trim()).toBe('lantern.mp4');
    expect(option('lantern.mp4').getAttribute('aria-checked')).toBe('true');
  });
});
