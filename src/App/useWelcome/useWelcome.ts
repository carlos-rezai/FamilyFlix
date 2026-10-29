import { createContext, useContext, type RefCallback } from 'react';

/** What `MainLayout`'s `LogoMark` takes from the welcome. */
export interface WelcomeApi {
  /** Receives the header wordmark: its mounting is what makes the home **Ready**. */
  wordmarkRef: RefCallback<HTMLElement>;
  /** Whether the header wordmark is held `visibility: hidden` under the splash. */
  wordmarkHidden: boolean;
}

/** Outside a welcome: a ref that does nothing and a wordmark always shown. */
const NO_WELCOME: WelcomeApi = {
  wordmarkRef: () => undefined,
  wordmarkHidden: false,
};

/**
 * The context object, owned here rather than by the provider so the
 * dependency runs one way, provider to hook, as `useSnackbar`'s does.
 */
export const WelcomeContext = createContext<WelcomeApi>(NO_WELCOME);

/**
 * `{ wordmarkRef, wordmarkHidden }` off the `WelcomeProvider`. Outside one
 * (the chrome mounted alone, in a test) it answers a no-op ref and `false`,
 * so the wordmark shows: the welcome is an addition, never a requirement.
 */
export function useWelcome(): WelcomeApi {
  return useContext(WelcomeContext);
}
