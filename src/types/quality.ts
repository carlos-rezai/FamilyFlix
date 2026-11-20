/**
 * The **Quality ladder**: every rung a **Video quality** can be, best first.
 * It is the one statement of the ladder's order; everything that ranks,
 * offers or reads a rung derives from it.
 */
export const VIDEO_QUALITIES = ['4K', '1080p', '720p', '480p', 'SD'] as const;

/** One rung of the **Quality ladder**. */
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];
