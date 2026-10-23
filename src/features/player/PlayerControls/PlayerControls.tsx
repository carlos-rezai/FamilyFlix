import {
  ChevronLeftIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SubtitlesIcon,
} from '@/primitives';
import type { AudioTrack, Subtitle } from '@/types';

import { AudioMenu } from '../AudioMenu/AudioMenu';
import { PlayerScrubber } from '../PlayerScrubber/PlayerScrubber';
import { SubtitleMenu } from '../SubtitleMenu/SubtitleMenu';
import { VolumeSlider } from '../VolumeSlider/VolumeSlider';
import {
  BackPill,
  BottomBar,
  RowSpacer,
  SubtitleButton,
  Title,
  TopBar,
  ChromeIconButton,
  TransportRow,
} from './PlayerControls.styles';

export interface PlayerControlsProps {
  /** The film's name, for the serif line beside the Back pill. */
  title: string;
  /** Whether the **Chrome** is on screen, or has faded into **Idle**. */
  visible: boolean;
  /** Whether the film is running, which is the transport button's face. */
  playing: boolean;
  /** The **Absolute position** the film is at, in seconds. */
  position: number;
  /** How long the film runs, from the **Playback read** by way of the screen above. */
  duration: number;
  /** How loud the film is, 0–1. */
  volume: number;
  /** Whether the film is silenced. */
  muted: boolean;
  /**
   * Whether the film has any **Subtitles** beside it. A film with none gets no
   * CC pill at all rather than a disabled one — a dead control on this screen is
   * a question a parent has to ask someone.
   */
  hasSubtitles: boolean;
  /**
   * Whether the film offers two **Audio tracks** or more. The **Audio picker**
   * is drawn only then, and absent rather than disabled otherwise — CC's rule
   * from the other side: a menu of one choice is a question with one answer.
   */
  hasAudioTracks: boolean;
  /** Whether the **Subtitle overlay** is showing, which is the pill's face. */
  subtitlesOn: boolean;
  /** Leave the player, back to the film's page. */
  onBack: () => void;
  /** Stop a running film, or start a stopped one. */
  onTogglePlay: () => void;
  /** Take the film to a second — the **Scrubber**, on release. */
  onSeek: (seconds: number) => void;
  /**
   * Move the film by a signed number of seconds. One handler with a delta
   * rather than two, because the keyboard map arrives next and has to move the
   * film the same way these buttons do rather than by a second code path.
   */
  onSkip: (deltaSeconds: number) => void;
  /** Set how loud the film is. */
  onVolumeChange: (value: number) => void;
  /** Silence the film, or give back the level it was at. */
  onToggleMute: () => void;
  /**
   * Turn subtitles on, or take them away again. One handler rather than an on
   * and an off: the state is the screen's, and this component is handed it
   * rather than remembering it.
   */
  onToggleSubtitles: () => void;
  /**
   * Fill the screen with the player's surface, or come back out of it. One
   * handler rather than two, and no `pressed` face: the prototype draws one
   * glyph in one state, and the document is where the answer to "are we
   * fullscreen" actually lives.
   */
  onToggleFullscreen: () => void;
  /** The offered **Audio tracks**, the picker's menu. */
  audioTracks: AudioTrack[];
  /** The track playing, marked in the picker's menu. */
  audioTrack: AudioTrack | null;
  /** A track chosen in the picker's menu. */
  onChooseAudio: (track: AudioTrack) => void;
  /** Told when the picker's menu opens or shuts, so the screen can hold the chrome up. */
  onAudioMenuChange: (open: boolean) => void;
  /**
   * Whether the film has two **Subtitles** or more. The **Subtitle picker** is
   * drawn in the CC pill's place only then; with one the pill is the toggle.
   */
  hasSubtitlePicker: boolean;
  /** The film's **Subtitles** in track order, the picker's rows. */
  subtitles: Subtitle[];
  /** The **Subtitle track**, marked in the picker's menu while subtitles show. */
  subtitleTrack: Subtitle | null;
  /** A row chosen in the picker's menu: the Subtitle, or `null` for _Off_. */
  onChooseSubtitle: (subtitle: Subtitle | null) => void;
  /** Told when the picker's menu opens or shuts, so the screen can hold the chrome up. */
  onSubtitleMenuChange: (open: boolean) => void;
}

/**
 * What the ±10s buttons move the film by, in seconds — and therefore what ←/→
 * move it by, because `usePlayerKeys` imports this one rather than declaring a
 * second. The chrome is where the number lives: it is written on the buttons'
 * own labels, and a keyboard that skipped by a different amount than the button
 * beside it would be the exact drift the keyboard hook exists to prevent.
 */
export const SKIP_SECONDS = 10;

/** How far each bar drifts as it fades — out the way it came in. */
const TOP_DRIFT = '-12px';
const BOTTOM_DRIFT = '12px';

/**
 * The **Chrome**: the player's two overlaid bars — Back pill and serif title
 * above, the transport row below — which fade in and out together as one thing.
 *
 * It is presentational. It is handed what is true and what to call, and decides
 * nothing: whether the chrome may fade at all is `useControlsVisibility`'s
 * question, and whether the film is playing is `usePlayback`'s.
 *
 * **Faded is not merely invisible.** The bars stay mounted so they have
 * something to fade back from, but their controls are unmounted while they are
 * gone — an invisible Back pill a keyboard can still land on is a control
 * nobody can see, and `pointer-events: none` alone would leave it exactly that.
 *
 * What it draws is `feat.PlayerControls.dc.html`, every control of it. The
 * fullscreen button was the last one held back, on the rule that a control which
 * does nothing when a parent presses it is worse than one that is not there yet;
 * there is something behind it now. The CC pill obeys the same rule from the
 * other direction — it is drawn only for a film that has **Subtitles**, and
 * absent rather than disabled for one that does not, which is why fullscreen
 * sits after it and is drawn for every film.
 */
export function PlayerControls({
  title,
  visible,
  playing,
  position,
  duration,
  volume,
  muted,
  hasSubtitles,
  hasAudioTracks,
  subtitlesOn,
  onBack,
  onTogglePlay,
  onSeek,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onToggleSubtitles,
  onToggleFullscreen,
  audioTracks,
  audioTrack,
  onChooseAudio,
  onAudioMenuChange,
  hasSubtitlePicker,
  subtitles,
  subtitleTrack,
  onChooseSubtitle,
  onSubtitleMenuChange,
}: PlayerControlsProps) {
  return (
    <>
      <TopBar $visible={visible} $drift={TOP_DRIFT} aria-hidden={!visible}>
        {visible ? (
          <BackPill type="button" onClick={onBack}>
            <ChevronLeftIcon />
            Back
          </BackPill>
        ) : null}
        <Title>{title}</Title>
      </TopBar>

      <BottomBar
        $visible={visible}
        $drift={BOTTOM_DRIFT}
        aria-hidden={!visible}
      >
        {visible ? (
          <>
            <PlayerScrubber
              position={position}
              duration={duration}
              onSeek={onSeek}
            />
            <TransportRow>
              <ChromeIconButton
                label={playing ? 'Pause' : 'Play'}
                size={48}
                onClick={onTogglePlay}
              >
                {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </ChromeIconButton>
              <ChromeIconButton
                label="Back 10s"
                title="Back 10s"
                size={44}
                onClick={() => onSkip(-SKIP_SECONDS)}
              >
                <SkipBackIcon size={22} />
              </ChromeIconButton>
              <ChromeIconButton
                label="Forward 10s"
                title="Forward 10s"
                size={44}
                onClick={() => onSkip(SKIP_SECONDS)}
              >
                <SkipForwardIcon size={22} />
              </ChromeIconButton>
              <VolumeSlider
                volume={volume}
                muted={muted}
                onVolumeChange={onVolumeChange}
                onToggleMute={onToggleMute}
              />
              <RowSpacer />
              {hasAudioTracks ? (
                <AudioMenu
                  tracks={audioTracks}
                  playing={audioTrack}
                  onChoose={onChooseAudio}
                  onOpenChange={onAudioMenuChange}
                />
              ) : null}
              {hasSubtitlePicker ? (
                <SubtitleMenu
                  subtitles={subtitles}
                  showing={subtitlesOn ? subtitleTrack : null}
                  onChoose={onChooseSubtitle}
                  onOpenChange={onSubtitleMenuChange}
                />
              ) : hasSubtitles ? (
                <SubtitleButton
                  type="button"
                  aria-label="Subtitles"
                  aria-pressed={subtitlesOn}
                  $on={subtitlesOn}
                  onClick={onToggleSubtitles}
                >
                  <SubtitlesIcon size={22} />
                  CC
                </SubtitleButton>
              ) : null}
              <ChromeIconButton
                label="Fullscreen"
                title="Fullscreen"
                size={44}
                onClick={onToggleFullscreen}
              >
                <FullscreenIcon size={22} />
              </ChromeIconButton>
            </TransportRow>
          </>
        ) : null}
      </BottomBar>
    </>
  );
}
