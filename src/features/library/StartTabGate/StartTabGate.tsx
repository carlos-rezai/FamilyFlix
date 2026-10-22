import type { ReactNode } from 'react';

import { useStartTab } from '@/features/library/useStartTab/useStartTab';

interface StartTabGateProps {
  children: ReactNode;
}

/**
 * Holds the browse home back until `useStartTab()` allows it: on the **Launch
 * entry** that is once the household's **Start tab** is honoured, so no Movies
 * frame (header included) is drawn before a Series start; anywhere else it is
 * at once.
 */
export function StartTabGate({ children }: StartTabGateProps) {
  const allowed = useStartTab();
  return allowed ? <>{children}</> : null;
}
