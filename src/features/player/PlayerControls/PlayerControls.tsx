import { ChevronLeftIcon, PauseIcon, PlayIcon } from '@/primitives';

import {
  BackPill,
  BottomBar,
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
  /** Leave the player, back to the film's page. */
  onBack: () => void;
  /** Stop a running film, or start a stopped one. */
  onTogglePlay: () => void;
}

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
 * What it draws is this slice's half of `feat.PlayerControls.dc.html`. The
 * scrubber and its two clocks, the volume slider and the ±10s buttons arrive
 * with the drag arithmetic; the CC pill arrives with subtitles, and only for a
 * film that has any; fullscreen arrives with the keyboard map. Each is drawn in
 * the slice that can make it do something, because a control that does nothing
 * when a parent presses it is worse than one that is not there yet.
 */
export function PlayerControls({
  title,
  visible,
  playing,
  onBack,
  onTogglePlay,
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
        <TransportRow>
          {visible ? (
            <TransportButton
              label={playing ? 'Pause' : 'Play'}
              size={48}
              onClick={onTogglePlay}
            >
              {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </TransportButton>
          ) : null}
        </TransportRow>
      </BottomBar>
    </>
  );
}
