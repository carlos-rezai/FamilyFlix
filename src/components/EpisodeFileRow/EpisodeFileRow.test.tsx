import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { EpisodeFileRow, type EpisodeFileRowProps } from '@/components';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 29 — Add a series, Phase 3 (issue #263): one **Episode file row**, from
 * `mol.EpisodeFileRow.dc.html`.
 *
 * Left to right: an `S` number field, an `E` number field, the episode's
 * title (_Untitled episode_ while empty) and the ✕; under them the filename in
 * mono, then a children slot for the row's subtitles. The number fields take
 * digits only — two for a season, three for an episode — and the row reports
 * every edit and the ✕ without holding anything itself.
 *
 * Presentational, like `SubtitleRow`: it never learns what a series is, what
 * a duplicate is, or where the numbers came from.
 */

const FILENAME = 'Harbor.and.Vine.S01E03.The.Night.Market.mkv';

function renderRow(props: Partial<EpisodeFileRowProps> = {}) {
  const onSeasonChange = vi.fn<(season: string) => void>();
  const onNumberChange = vi.fn<(number: string) => void>();
  const onTitleChange = vi.fn<(title: string) => void>();
  const onRemove = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <EpisodeFileRow
        filename={FILENAME}
        season="1"
        number="3"
        title="The Night Market"
        onSeasonChange={onSeasonChange}
        onNumberChange={onNumberChange}
        onTitleChange={onTitleChange}
        onRemove={onRemove}
        {...props}
      />
    </ThemeProvider>
  );

  return { onSeasonChange, onNumberChange, onTitleChange, onRemove };
}

const seasonField = () =>
  screen.getByRole('textbox', { name: 'Season' }) as HTMLInputElement;
const numberField = () =>
  screen.getByRole('textbox', { name: 'Episode' }) as HTMLInputElement;
const titleField = () =>
  screen.getByRole('textbox', { name: 'Episode title' }) as HTMLInputElement;
const removeButton = () =>
  screen.getByRole('button', { name: `Remove ${FILENAME}` });

describe('EpisodeFileRow — what it draws', () => {
  it('draws the season and the number it is given', () => {
    renderRow();

    expect(seasonField().value).toBe('1');
    expect(numberField().value).toBe('3');
  });

  it('labels the two number fields S and E', () => {
    renderRow();

    expect(screen.getByText('S')).toBeDefined();
    expect(screen.getByText('E')).toBeDefined();
  });

  it('draws the episode title', () => {
    renderRow();
    expect(titleField().value).toBe('The Night Market');
  });

  it('offers Untitled episode as the empty title’s placeholder', () => {
    renderRow({ title: '' });

    expect(titleField().value).toBe('');
    expect(titleField().placeholder).toBe('Untitled episode');
  });

  it('draws the filename', () => {
    renderRow();

    expect(screen.getByText(FILENAME)).toBeDefined();
  });

  it('draws a ✕ named after the file it takes off', () => {
    renderRow();

    expect(removeButton()).toBeDefined();
  });
});

describe('EpisodeFileRow — the number fields', () => {
  it('passes a season of digits through', () => {
    const { onSeasonChange } = renderRow();

    fireEvent.change(seasonField(), { target: { value: '12' } });

    expect(onSeasonChange).toHaveBeenLastCalledWith('12');
  });

  it('drops anything but digits from the season', () => {
    const { onSeasonChange } = renderRow();

    fireEvent.change(seasonField(), { target: { value: '1a' } });

    expect(onSeasonChange).toHaveBeenLastCalledWith('1');
  });

  it('holds the season to two digits', () => {
    const { onSeasonChange } = renderRow();

    fireEvent.change(seasonField(), { target: { value: '123' } });

    expect(onSeasonChange).toHaveBeenLastCalledWith('12');
  });

  it('passes an episode number of digits through', () => {
    const { onNumberChange } = renderRow();

    fireEvent.change(numberField(), { target: { value: '120' } });

    expect(onNumberChange).toHaveBeenLastCalledWith('120');
  });

  it('drops anything but digits from the episode number', () => {
    const { onNumberChange } = renderRow();

    fireEvent.change(numberField(), { target: { value: '3-b' } });

    expect(onNumberChange).toHaveBeenLastCalledWith('3');
  });

  it('holds the episode number to three digits', () => {
    const { onNumberChange } = renderRow();

    fireEvent.change(numberField(), { target: { value: '1234' } });

    expect(onNumberChange).toHaveBeenLastCalledWith('123');
  });

  it('reports a field cleared as the empty string', () => {
    const { onSeasonChange, onNumberChange } = renderRow();

    fireEvent.change(seasonField(), { target: { value: '' } });
    fireEvent.change(numberField(), { target: { value: '' } });

    expect(onSeasonChange).toHaveBeenLastCalledWith('');
    expect(onNumberChange).toHaveBeenLastCalledWith('');
  });
});

describe('EpisodeFileRow — what it reports', () => {
  it('reports the title as typed', () => {
    const { onTitleChange } = renderRow();

    fireEvent.change(titleField(), { target: { value: 'The Long Night' } });

    expect(onTitleChange).toHaveBeenLastCalledWith('The Long Night');
  });

  it('reports the ✕', () => {
    const { onRemove } = renderRow();

    fireEvent.click(removeButton());

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('EpisodeFileRow — the children slot', () => {
  it('renders its children under the filename', () => {
    renderRow({ children: <button type="button">＋ Add subtitle</button> });

    const child = screen.getByRole('button', { name: '＋ Add subtitle' });
    expect(comesBefore(screen.getByText(FILENAME), child)).toBe(true);
  });
});
