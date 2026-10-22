import type { ReactNode } from 'react';

import { useStartTabSettled } from '@/features/library/useStartTabSettled/useStartTabSettled';

interface StartTabGateProps {
  children: ReactNode;
}

/**
 * Holds the browse home back until `useStartTabSettled()` allows it: on the
 * **Launch entry** that is once the household's **Start tab** is honoured, so no Movies
 * frame (header included) is drawn before a Series start; anywhere else it is
 * at once.
 */
export function StartTabGate({ children }: StartTabGateProps) {
  const allowed = useStartTabSettled();
  return allowed ? children : null;
}
