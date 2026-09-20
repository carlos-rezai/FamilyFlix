import { createContext, useContext } from 'react';

import type { SnackbarVariant } from '@/components';

/**
 * What a consumer hands `notify`: the **Snackbar notice** — named so because
 * **Player notice** is already a glossary term. `action` nests its label with
 * its handler on purpose: a label with no handler is meaningless to a queue
 * that must wire the dismissal to it. No `duration`, no `dismissible`: the
 * timer rule is the queue's, not the caller's.
 */
export interface SnackbarNotice {
  variant: SnackbarVariant;
  /** The bold line above the message, when there is one. */
  title?: string;
  /** What the card says. */
  message: string;
  /** The bordered action on the card, when there is one. */
  action?: { label: string; onClick: () => void };
}

export interface SnackbarApi {
  /** Raise a notice; answers the id it can be retracted by. */
  notify: (notice: SnackbarNotice) => number;
  /** Take a notice off early; harmless on an id that is already gone. */
  dismiss: (id: number) => void;
}

/**
 * The context object, owned here rather than by the provider so the dependency
 * runs one way — provider → hook — and a consumer never pulls the provider's
 * styles in behind the hook.
 */
export const SnackbarContext = createContext<SnackbarApi | null>(null);

/**
 * `{ notify, dismiss }` off the **Snackbar stack** above the route table. The
 * provider is mounted in `App`, so a consumer outside one is a wiring mistake,
 * and a no-op would hide it: it throws, naming itself (the `useGenreMovies`
 * precedent).
 */
export function useSnackbar(): SnackbarApi {
  const value = useContext(SnackbarContext);
  if (value === null) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return value;
}
