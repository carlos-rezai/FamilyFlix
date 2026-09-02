import {
  ChevronLeftIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SubtitlesIcon,
} from '@/primitives';

import { PlayerScrubber } from '../PlayerScrubber/PlayerScrubber';
import { VolumeSlider } from '../VolumeSlider/VolumeSlider';
import {
  BackPill,
  BottomBar,
  RowSpacer,
  SubtitleButton,
  Title,
  TopBar,
  TransportButton,
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
}

/** What the ±10s buttons move the film by, in seconds. */
const SKIP_SECONDS = 10;

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
 * What it draws is `feat.PlayerControls.dc.html` less one control: fullscreen
 * arrives with the keyboard map, in the slice that can make it do something,
 * because a control that does nothing when a parent presses it is worse than one
 * that is not there yet. The CC pill obeys the same rule from the other
 * direction — it is drawn only for a film that has **Subtitles**, and absent
 * rather than disabled for one that does not.
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
  subtitlesOn,
  onBack,
  onTogglePlay,
  onSeek,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onToggleSubtitles,
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
              <TransportButton
                label={playing ? 'Pause' : 'Play'}
                size={48}
                onClick={onTogglePlay}
              >
                {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </TransportButton>
              <TransportButton
                label="Back 10s"
                title="Back 10s"
                size={44}
                onClick={() => onSkip(-SKIP_SECONDS)}
              >
                <SkipBackIcon size={22} />
              </TransportButton>
              <TransportButton
                label="Forward 10s"
                title="Forward 10s"
                size={44}
                onClick={() => onSkip(SKIP_SECONDS)}
              >
                <SkipForwardIcon size={22} />
              </TransportButton>
              <VolumeSlider
                volume={volume}
                muted={muted}
                onVolumeChange={onVolumeChange}
                onToggleMute={onToggleMute}
              />
              <RowSpacer />
              {hasSubtitles ? (
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
            </TransportRow>
          </>
        ) : null}
      </BottomBar>
    </>
  );
}
