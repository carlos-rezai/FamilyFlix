import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { readFileSync } from 'node:fs';

import { PlayerControls } from './PlayerControls';
import { theme } from '@/styles/theme';
import type { AudioTrack, Subtitle } from '@/types';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { ChromeIconButton } from './PlayerControls.styles';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * The **Chrome**: the player's two overlaid bars — Back pill and serif title
 * above, the transport row below — which fade in and out together as one thing.
 * A 1:1 translation of `feat.PlayerControls.dc.html`. The **Scrubber** and the
 * volume slider arrived in the next slice and are asserted further down this
 * file.
 *
 * It is presentational: it is handed what is true and what to call, and decides
 * nothing. Whether the chrome may fade at all is `useControlsVisibility`'s
 * question, and whether the film is playing is `usePlayback`'s.
 */
const FILM = 'Northwind';

/** The film's length, as the **Playback read** reports it: `1:53:52`. */
const DURATION = 6832.5;

function renderControls(
  overrides: Partial<Parameters<typeof PlayerControls>[0]> = {}
) {
  const onBack = vi.fn();
  const onTogglePlay = vi.fn();
  const onSeek = vi.fn<(seconds: number) => void>();
  const onSkip = vi.fn<(deltaSeconds: number) => void>();
  const onVolumeChange = vi.fn<(value: number) => void>();
  const onToggleMute = vi.fn();
  const onToggleSubtitles = vi.fn();
  const onToggleFullscreen = vi.fn();
  const view = render(
    <ThemeProvider theme={theme}>
      <PlayerControls
        title={FILM}
        visible
        playing
        position={0}
        duration={DURATION}
        volume={0.8}
        muted={false}
        hasSubtitles
        hasAudioTracks={false}
        subtitlesOn={false}
        onBack={onBack}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onSkip={onSkip}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
        onToggleSubtitles={onToggleSubtitles}
        onToggleFullscreen={onToggleFullscreen}
        audioTracks={[]}
        audioTrack={null}
        onChooseAudio={vi.fn()}
        onAudioMenuChange={vi.fn()}
        hasSubtitlePicker={false}
        subtitles={[]}
        subtitleTrack={null}
        onChooseSubtitle={vi.fn()}
        onSubtitleMenuChange={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>
  );

  return {
    ...view,
    onBack,
    onTogglePlay,
    onSeek,
    onSkip,
    onVolumeChange,
    onToggleMute,
    onToggleSubtitles,
    onToggleFullscreen,
  };
}

describe('PlayerControls', () => {
  it('names the film on screen, so a parent knows they opened the right one', () => {
    renderControls();

    expect(screen.getByText(FILM)).toBeDefined();
  });

  it('offers the way back to the film’s page', () => {
    const { onBack } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('offers a pause control while the film is running', () => {
    const { onTogglePlay } = renderControls({ playing: true });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('offers a play control while the film is stopped', () => {
    // One control, two faces — the same handler, so the button and the picture
    // can never disagree about what pressing it does.
    const { onTogglePlay } = renderControls({ playing: false });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('takes its controls out of reach once the chrome has faded', () => {
    // Faded chrome must not be operable or announced: an invisible Back pill
    // that a keyboard can still land on is a control nobody can see.
    renderControls({ visible: false });

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('fades rather than disappears, so it has something to fade back from', () => {
    const { container } = renderControls({ visible: false });

    expect(container.textContent).toContain(FILM);
  });
});

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * The transport row fills out: the **Scrubber** and its two clocks above it,
 * the ±10s buttons and the volume control beside play/pause. The chrome still
 * decides nothing — it is handed the position, the duration, the volume and
 * the mute state, and calls back.
 *
 * The CC pill and fullscreen were drawn inert here and made to do something in
 * the slices that could — subtitles in issue 88, fullscreen in issue 91 — and
 * both are asserted below.
 */
describe('PlayerControls — the transport row', () => {
  it('shows how far in the film is and how long it runs', () => {
    // The clock the previous slice deliberately did not draw. Both come from
    // the **Playback read** by way of the screen above, so a film the
    // catalogue has no runtime for still gets both.
    renderControls({ position: 2450, duration: 6832.5 });

    expect(screen.getByText('40:50')).toBeDefined();
    expect(screen.getByText('1:53:52')).toBeDefined();
  });

  it('replays the last ten seconds', () => {
    const { onSkip } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Back 10s' }));

    expect(onSkip).toHaveBeenCalledExactlyOnceWith(-10);
  });

  it('skips the next ten seconds', () => {
    // One handler with a signed delta rather than two, because the keyboard
    // map arrives next and has to move the film the same way the buttons do
    // rather than by a second code path.
    const { onSkip } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Forward 10s' }));

    expect(onSkip).toHaveBeenCalledExactlyOnceWith(10);
  });

  it('carries the volume control beside the transport', () => {
    const { onToggleMute } = renderControls({ volume: 0.8, muted: false });

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('takes both sliders out of reach once the chrome has faded', () => {
    // Same rule as the Back pill: a scrubber a keyboard can still land on
    // while nothing is on screen is a control nobody can see. Asserted from
    // both sides, because an absence on its own is also what a slider that was
    // never drawn at all looks like.
    const { rerender } = renderControls();
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeDefined();

    rerender(
      <ThemeProvider theme={theme}>
        <PlayerControls
          title={FILM}
          visible={false}
          playing
          position={0}
          duration={DURATION}
          volume={0.8}
          muted={false}
          hasSubtitles
          hasAudioTracks={false}
          subtitlesOn={false}
          onBack={vi.fn()}
          onTogglePlay={vi.fn()}
          onSeek={vi.fn()}
          onSkip={vi.fn()}
          onVolumeChange={vi.fn()}
          onToggleMute={vi.fn()}
          onToggleSubtitles={vi.fn()}
          onToggleFullscreen={vi.fn()}
          audioTracks={[]}
          audioTrack={null}
          onChooseAudio={vi.fn()}
          onAudioMenuChange={vi.fn()}
          hasSubtitlePicker={false}
          subtitles={[]}
          subtitleTrack={null}
          onChooseSubtitle={vi.fn()}
          onSubtitleMenuChange={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.queryByRole('slider', { name: 'Seek' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Volume' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back 10s' })).toBeNull();
  });
});

/**
 * The acceptance criterion that is about the shape of the code rather than
 * what is on screen, checked the only way it can be: at the source. The two
 * sliders share the drag arithmetic and nothing else — no styled component
 * between them, and neither reaching into the other. Both would still pass
 * every behavioural test above on the day one of them became a prop on the
 * other, which is exactly why this one exists.
 *
 * The precedent is the duration rule in `usePlayback.test.ts`: a structural
 * promise, kept by reading the files.
 */
describe('the two sliders', () => {
  const scrubber = 'src/features/player/PlayerScrubber';
  const volume = 'src/features/player/VolumeSlider';

  it('both sit on the shared drag hook', () => {
    expect(sourceOf(`${scrubber}/PlayerScrubber.tsx`)).toContain(
      'useDragScalar'
    );
    expect(sourceOf(`${volume}/VolumeSlider.tsx`)).toContain('useDragScalar');
  });

  it('share no styled component, and neither imports the other', () => {
    const scrubberSource = [
      sourceOf(`${scrubber}/PlayerScrubber.tsx`),
      sourceOf(`${scrubber}/PlayerScrubber.styles.ts`),
    ].join('\n');
    const volumeSource = [
      sourceOf(`${volume}/VolumeSlider.tsx`),
      sourceOf(`${volume}/VolumeSlider.styles.ts`),
    ].join('\n');

    expect(scrubberSource).not.toMatch(/VolumeSlider/);
    expect(volumeSource).not.toMatch(/PlayerScrubber/);
  });
});

/** One of the feature's files, read off disk — the seam a structural rule has. */
function sourceOf(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * 10 — Video player, Phase 6: "subtitles" (issue #88).
 *
 * The CC pill, the last control `feat.PlayerControls.dc.html` draws that this
 * component had left out — deliberately, because a control that does nothing
 * when a parent presses it is worse than one that is not there yet, and there
 * was nothing to turn on until now.
 *
 * It ships as the plain toggle the prototype draws. A **Subtitle track** picker
 * behind it would be new UI and therefore a prototype amendment, so
 * `preferredSubtitle` chooses and nobody else does.
 *
 * The prototype draws it inside an `sc-if` on `p.hasSubs`, and that is the
 * behaviour worth guarding hardest: a film with no subtitle files gets **no
 * button at all**, not a disabled one. A dead control on a screen my parents
 * use is a question they have to ask me.
 */
describe('PlayerControls — the CC pill', () => {
  it('is drawn for a film that has subtitle files', () => {
    renderControls({ hasSubtitles: true });

    expect(screen.getByRole('button', { name: 'Subtitles' })).toBeDefined();
  });

  it('says CC on it, as the prototype draws it', () => {
    renderControls({ hasSubtitles: true });

    expect(
      screen.getByRole('button', { name: 'Subtitles' }).textContent
    ).toContain('CC');
  });

  it('is not drawn at all for a film with no subtitle files', () => {
    // Absent, not disabled. There is nothing to press and nothing to explain.
    //
    // Stated against the film that *does* have them, in the same test: an
    // absence on its own is satisfied by a control that was never built, by a
    // renamed one, and by a typo in the query — none of which is the behaviour
    // being claimed.
    const { unmount } = renderControls({ hasSubtitles: true });
    expect(screen.getByRole('button', { name: 'Subtitles' })).toBeDefined();
    unmount();

    renderControls({ hasSubtitles: false });

    expect(screen.queryByRole('button', { name: 'Subtitles' })).toBeNull();
    expect(screen.queryByText('CC')).toBeNull();
  });

  it('asks for subtitles to be turned on when it is pressed', () => {
    const { onToggleSubtitles } = renderControls({ subtitlesOn: false });

    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));

    expect(onToggleSubtitles).toHaveBeenCalledTimes(1);
  });

  it('asks for them to be turned off again on the next press', () => {
    // One handler, not an on and an off: the state is the screen's, and this
    // component is handed it rather than remembering it.
    const { onToggleSubtitles } = renderControls({ subtitlesOn: true });

    fireEvent.click(screen.getByRole('button', { name: 'Subtitles' }));

    expect(onToggleSubtitles).toHaveBeenCalledTimes(1);
  });

  it('reads as switched on while subtitles are showing', () => {
    // `aria-pressed`, so the state is available to something that cannot see
    // the lit face below.
    renderControls({ subtitlesOn: true });

    expect(
      screen
        .getByRole('button', { name: 'Subtitles' })
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('reads as switched off while they are not', () => {
    renderControls({ subtitlesOn: false });

    expect(
      screen
        .getByRole('button', { name: 'Subtitles' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('wears the prototype’s lit face when on, and its dim one when off', () => {
    // `subBtn` in `FamilyFlix.dc.html`: a filled, brighter-bordered, white-inked
    // pill when on; transparent and faint when off. The state has to be visible
    // to a parent glancing at it, not only to a screen reader.
    const { unmount } = renderControls({ subtitlesOn: true });
    const on = window.getComputedStyle(
      screen.getByRole('button', { name: 'Subtitles' })
    );
    expect(on.backgroundColor).toBe('rgba(255, 255, 255, 0.16)');
    expect(on.color).toBe('rgb(255, 255, 255)');
    unmount();

    renderControls({ subtitlesOn: false });
    const off = window.getComputedStyle(
      screen.getByRole('button', { name: 'Subtitles' })
    );
    expect(off.backgroundColor).not.toBe('rgba(255, 255, 255, 0.16)');
    expect(off.color).not.toBe('rgb(255, 255, 255)');
  });

  it('goes with the rest of the chrome when the player idles', () => {
    // The bars fade as one thing, and their controls are unmounted behind the
    // fade — an invisible pill a keyboard could still land on is exactly what
    // the rest of this row already avoids. Paired with the visible case for the
    // same reason as above.
    const { unmount } = renderControls({ visible: true });
    expect(screen.getByRole('button', { name: 'Subtitles' })).toBeDefined();
    unmount();

    renderControls({ visible: false });

    expect(screen.queryByRole('button', { name: 'Subtitles' })).toBeNull();
  });
});

/**
 * 10 — Video player, Phase 8 (issue #91).
 *
 * The fullscreen button — the last control `feat.PlayerControls.dc.html` draws
 * that this component had left out, and left out for the reason the CC pill
 * was: a control that does nothing when a parent presses it is worse than one
 * that is not there yet. There is something behind it now.
 *
 * The prototype draws one glyph and one tooltip, in one state, at the end of
 * the row. That is what ships: no second face, no `aria-pressed`, nothing this
 * slice invents. The rest of the row is untouched — everything asserted in the
 * blocks above still holds, which is the acceptance criterion about the
 * rendered surface, read as it was meant.
 */
describe('PlayerControls — the fullscreen button', () => {
  it('is drawn for every film, unlike the CC pill', () => {
    // The pill depends on the film having subtitle files. This does not: any
    // film can fill the television.
    renderControls({ hasSubtitles: false });

    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeDefined();
  });

  it('fills the screen when it is pressed', () => {
    const { onToggleFullscreen } = renderControls();

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('sits at the end of the row, after the CC pill', () => {
    // The prototype's order, which is also the reading order a keyboard walks:
    // transport, volume, the flexible gap, captions, fullscreen.
    renderControls({ hasSubtitles: true });

    const captions = screen.getByRole('button', { name: 'Subtitles' });
    const fullscreen = screen.getByRole('button', { name: 'Fullscreen' });

    expect(
      captions.compareDocumentPosition(fullscreen) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('is the 44px square the prototype draws, like the ±10s buttons beside it', () => {
    renderControls();

    const style = window.getComputedStyle(
      screen.getByRole('button', { name: 'Fullscreen' })
    );

    expect(style.width).toBe('44px');
    expect(style.height).toBe('44px');
  });

  it('names itself on hover, as the prototype does', () => {
    // `title="Fullscreen"` in `feat.PlayerControls.dc.html` — the tooltip is
    // the only label the prototype gives an icon nobody has to recognise.
    renderControls();

    expect(
      screen.getByRole('button', { name: 'Fullscreen' }).getAttribute('title')
    ).toBe('Fullscreen');
  });

  it('goes with the rest of the chrome when the player idles', () => {
    // Same rule as every other control in the row: unmounted behind the fade,
    // so a keyboard cannot land on something nobody can see. Paired with the
    // visible case, because an absence on its own is also what a button that
    // was never drawn looks like.
    const { unmount } = renderControls({ visible: true });
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeDefined();
    unmount();

    renderControls({ visible: false });

    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeNull();
  });
});

/**
 * 21 — Motion & interaction states, Phase 4 (issue #184): the transport and
 * chrome buttons on IconButton's Control states; their file draws no scale.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * what the injected stylesheet resolves to for the rendered button in that
 * state — the cascade run by `resolvedStyle` — never a computed style.
 */
describe('PlayerControls — the chrome icon button through hover, press and focus', () => {
  it('shows a press and the ring, and does not scale on hover', () => {
    render(
      <ThemeProvider theme={theme}>
        <ChromeIconButton label="Play">
          <span />
        </ChromeIconButton>
      </ThemeProvider>
    );
    const button = screen.getByRole('button', { name: 'Play' });

    expect(resolvedStyle(button, { hover: true }).transform ?? 'none').toBe(
      'none'
    );
    const press = resolvedStyle(button, { hover: true, active: true });
    expect(press.transform).toBe(normCss('scale(.94)'));
    expect(press['transition-duration']).toBe('60ms');
    expect(resolvedStyle(button, { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${theme.colors.focusRing}`)
    );
  });
});

/**
 * 46 — Audio tracks, Phase 5: "the picker" (issue #403).
 *
 * The **Audio picker** joins the transport row's right group as
 * `[Audio] [CC] [Fullscreen]`, on CC's rule from the other side: drawn only
 * when it is handed `hasAudioTracks` — two or more offered **Audio tracks**,
 * `useAudioTracks`' rule — and absent rather than disabled otherwise. The
 * chrome is handed the tracks, the playing one and what to call, and passes
 * them through; like every other control it is gone while the
 * chrome is faded.
 */
describe('PlayerControls — the Audio picker', () => {
  const ENGLISH: AudioTrack = {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: true,
    path: 'direct',
  };
  const SPANISH: AudioTrack = {
    index: 1,
    language: 'Spanish',
    label: 'Spanish',
    fileDefault: false,
    path: 'remux',
  };

  it('is drawn when the film has audio tracks to choose, and absent otherwise', () => {
    const two = renderControls({
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: ENGLISH,
    });
    expect(screen.getByRole('button', { name: 'Audio' })).toBeDefined();
    two.unmount();

    const one = renderControls({ audioTracks: [ENGLISH], audioTrack: ENGLISH });
    expect(screen.queryByRole('button', { name: 'Audio' })).toBeNull();
    one.unmount();

    renderControls({ audioTracks: [], audioTrack: null });
    expect(screen.queryByRole('button', { name: 'Audio' })).toBeNull();
  });

  it('is drawn for a film with two tracks, before the CC pill', () => {
    renderControls({
      hasSubtitles: true,
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: ENGLISH,
    });

    const audio = screen.getByRole('button', { name: 'Audio' });
    const captions = screen.getByRole('button', { name: 'Subtitles' });
    const fullscreen = screen.getByRole('button', { name: 'Fullscreen' });

    expect(comesBefore(audio, captions)).toBe(true);
    expect(comesBefore(captions, fullscreen)).toBe(true);
  });

  it('sits before fullscreen for a film with no subtitles', () => {
    renderControls({
      hasSubtitles: false,
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: ENGLISH,
    });

    expect(
      comesBefore(
        screen.getByRole('button', { name: 'Audio' }),
        screen.getByRole('button', { name: 'Fullscreen' })
      )
    ).toBe(true);
  });

  it('opens on the tracks it is handed, the playing one marked, and hands back a choice', () => {
    const onChooseAudio = vi.fn<(choice: AudioTrack) => void>();
    renderControls({
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: SPANISH,
      onChooseAudio,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    const items = screen.getAllByRole('menuitem');

    expect(items.map((item) => item.textContent)).toEqual([
      'English',
      'Spanish',
    ]);
    expect(items[1]?.getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByRole('menuitem', { name: 'English' }));

    expect(onChooseAudio).toHaveBeenCalledWith(ENGLISH);
  });

  it('says when its menu opens and shuts, so the screen can hold the chrome up', () => {
    const onAudioMenuChange = vi.fn<(open: boolean) => void>();
    renderControls({
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: ENGLISH,
      onAudioMenuChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    expect(onAudioMenuChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onAudioMenuChange).toHaveBeenLastCalledWith(false);
  });

  it('is out of reach once the chrome has faded, like every control', () => {
    const shown = renderControls({
      visible: true,
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: ENGLISH,
    });
    expect(screen.getByRole('button', { name: 'Audio' })).toBeDefined();
    shown.unmount();

    renderControls({
      visible: false,
      hasAudioTracks: true,
      audioTracks: [ENGLISH, SPANISH],
      audioTrack: ENGLISH,
    });

    expect(screen.queryByRole('button', { name: 'Audio' })).toBeNull();
  });
});

/**
 * 50, Subtitle picker, Phase 5: "the picker in the player" (issue #439).
 *
 * Handed `hasSubtitlePicker` (two **Subtitles** or more), the chrome draws the
 * **Subtitle picker** in the CC pill's place, its slot after the Audio picker
 * in the right group: the pill as a menu button, never also a toggle. With one
 * file it is the toggle as before, with none there is no pill.
 */
describe('PlayerControls: the Subtitle picker', () => {
  const ENGLISH: Subtitle = {
    id: 's-en',
    language: 'English',
    position: 0,
    path: 'Northwind (1994)/northwind.en.srt',
  };
  const SPANISH: Subtitle = {
    id: 's-es',
    language: 'Spanish',
    position: 1,
    path: 'Northwind (1994)/northwind.es.srt',
  };
  const AUDIO_EN: AudioTrack = {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: true,
    path: 'direct',
  };
  const AUDIO_ES: AudioTrack = {
    index: 1,
    language: 'Spanish',
    label: 'Spanish',
    fileDefault: false,
    path: 'remux',
  };

  const pill = () => screen.getByRole('button', { name: 'Subtitles' });

  function renderPicker(
    overrides: Partial<Parameters<typeof PlayerControls>[0]> = {}
  ) {
    return renderControls({
      hasSubtitles: true,
      hasSubtitlePicker: true,
      subtitles: [ENGLISH, SPANISH],
      subtitleTrack: null,
      ...overrides,
    });
  }

  it('draws the picker in the pill’s place for two files: a menu button, not a toggle', () => {
    renderPicker();

    expect(screen.getAllByRole('button', { name: 'Subtitles' })).toHaveLength(
      1
    );
    expect(pill().textContent).toContain('CC');
    expect(pill().getAttribute('aria-haspopup')).toBe('menu');
    expect(pill().hasAttribute('aria-pressed')).toBe(false);
  });

  it('draws the toggle with aria-pressed for one file, where two draw the picker', () => {
    const two = renderPicker();
    expect(pill().getAttribute('aria-haspopup')).toBe('menu');
    two.unmount();

    const { onToggleSubtitles } = renderControls({
      hasSubtitles: true,
      hasSubtitlePicker: false,
      subtitles: [ENGLISH],
      subtitleTrack: ENGLISH,
      subtitlesOn: false,
    });

    expect(pill().getAttribute('aria-pressed')).toBe('false');
    expect(pill().hasAttribute('aria-haspopup')).toBe(false);
    fireEvent.click(pill());
    expect(onToggleSubtitles).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('draws no pill for a film with no files, where two draw the picker', () => {
    const two = renderPicker();
    expect(pill().getAttribute('aria-haspopup')).toBe('menu');
    two.unmount();

    renderControls({
      hasSubtitles: false,
      hasSubtitlePicker: false,
      subtitles: [],
      subtitleTrack: null,
    });

    expect(screen.queryByRole('button', { name: 'Subtitles' })).toBeNull();
    expect(screen.queryByText('CC')).toBeNull();
  });

  it('keeps the pill’s slot: after the Audio picker, before fullscreen', () => {
    renderPicker({
      hasAudioTracks: true,
      audioTracks: [AUDIO_EN, AUDIO_ES],
      audioTrack: AUDIO_EN,
    });

    expect(pill().getAttribute('aria-haspopup')).toBe('menu');
    expect(
      comesBefore(screen.getByRole('button', { name: 'Audio' }), pill())
    ).toBe(true);
    expect(
      comesBefore(pill(), screen.getByRole('button', { name: 'Fullscreen' }))
    ).toBe(true);
  });

  it('opens on Off then the files, the showing one marked, and hands back a choice', () => {
    const onChooseSubtitle = vi.fn<(subtitle: Subtitle | null) => void>();
    renderPicker({
      subtitleTrack: SPANISH,
      subtitlesOn: true,
      onChooseSubtitle,
    });

    fireEvent.click(pill());
    const items = screen.getAllByRole('menuitem');

    expect(items.map((item) => item.textContent)).toEqual([
      'Off',
      'English',
      'Spanish',
    ]);
    expect(items[2]?.getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByRole('menuitem', { name: 'English' }));

    expect(onChooseSubtitle).toHaveBeenCalledWith(ENGLISH);
  });

  it('marks Off while subtitles are off, and hands back null for it', () => {
    const onChooseSubtitle = vi.fn<(subtitle: Subtitle | null) => void>();
    renderPicker({ subtitleTrack: null, onChooseSubtitle });

    fireEvent.click(pill());
    const marked = screen
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-current') === 'true')
      .map((item) => item.textContent);
    expect(marked).toEqual(['Off']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Off' }));

    expect(onChooseSubtitle).toHaveBeenCalledWith(null);
  });

  it('says when its menu opens and shuts, so the screen can hold the chrome up', () => {
    const onSubtitleMenuChange = vi.fn<(open: boolean) => void>();
    renderPicker({ onSubtitleMenuChange });

    fireEvent.click(pill());
    expect(onSubtitleMenuChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSubtitleMenuChange).toHaveBeenLastCalledWith(false);
  });
});
