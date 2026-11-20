import type { VideoQuality } from '@/types';

import type { FrameSize } from '../probe/probe';

/**
 * Each rung's floor of **Nominal height**, best first: halfway between it and
 * the rung below. Below the last floor is `SD`.
 */
const FLOORS: ReadonlyArray<readonly [VideoQuality, number]> = [
  ['4K', 1620],
  ['1080p', 900],
  ['720p', 600],
  ['480p', 420],
];

/**
 * The rung of the **Quality ladder** a frame sits on, by its **Nominal
 * height**: the larger of its height and its width × 9/16, so a widescreen
 * crop and a 4:3 frame land on the rung their picture was made for. The coded
 * frame is read as given; the sample aspect ratio is not.
 *
 * `null` for a frame nothing could size, or one with a missing or nought
 * dimension.
 */
export function qualityOf(frame: FrameSize | null): VideoQuality | null {
  if (frame === null) {
    return null;
  }
  const { width, height } = frame;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const nominal = Math.max(height, (width * 9) / 16);
  return FLOORS.find(([, floor]) => nominal >= floor)?.[0] ?? 'SD';
}
