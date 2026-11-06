/**
 * The **Tidy** contracts both build targets read: what a **Library folder**'s
 * **Loose videos** would become. See `docs/PRDs/57-tidy-into-folders.md` and
 * `docs/design-logs/57-tidy-into-folders.md`.
 */

/**
 * One **Tidy**: a Loose video, its **Companion files** with it, moved into a
 * folder of its own named the **Tidy folder name**. Every name is as the root
 * lists it.
 */
export interface Tidy {
  /** The first video's name, case folded: stable for one read. */
  id: string;
  kind: 'film' | 'show';
  /** The **Tidy folder name**. */
  folder: string;
  videos: string[];
  companions: string[];
}

/** Loose files a Tidy leaves where they are, and the sentence saying why. */
export interface KeptLoose {
  files: string[];
  reason: string;
  /** The **Tidy folder name** they would have taken, when they have one. */
  folder?: string;
}

/** A root's **Tidy plan**: the tidies it offers and the files it keeps. */
export interface TidyPlan {
  path: string;
  tidies: Tidy[];
  kept: KeptLoose[];
}

/** What _Move N videos_ answers: the videos moved and each Tidy that failed. */
export interface TidyResult {
  /** Videos moved, across every Tidy that moved. */
  moved: number;
  failed: { id: string; folder: string; reason: string }[];
}
