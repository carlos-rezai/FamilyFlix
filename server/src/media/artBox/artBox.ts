import type { PictureSize } from '../pictureSize/pictureSize';

/** The **Art box** of a landscape picture: a backdrop or a still, 1920 wide. */
export const LANDSCAPE_BOX = 1920;

/** The **Art box** of a portrait picture: the 300px detail poster frame at 2.6x. */
export const PORTRAIT_BOX = 780;

/**
 * The width a picture is fitted to, or `null` for one within its **Art box**.
 * By shape, not role, because the media domain writes by filename: at least
 * as wide as it is tall is landscape, anything else portrait. Never enlarged;
 * the height follows.
 */
export function artBox({ width, height }: PictureSize): number | null {
  const box = width >= height ? LANDSCAPE_BOX : PORTRAIT_BOX;
  return width > box ? box : null;
}
