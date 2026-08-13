import type { ReactNode } from 'react';

import { Root, Title, Body, Action } from './LoadMessage.styles';

export interface LoadMessageProps {
  /** What happened, in a few words. */
  title: string;
  /** One line under it, saying what that means. */
  body: string;
  /**
   * The way forward, when there is one. Omitted rather than disabled when
   * there isn't: an empty library offers nothing to retry, and a 404 offers
   * nothing to reload.
   */
  action?: ReactNode;
  /** Set by `styled(LoadMessage)`, which is how a caller places the block. */
  className?: string;
}

/**
 * The centred title / body / action block a screen shows in place of its
 * content — an empty library, a library that failed to load, a movie that is
 * gone, and a movie that failed to load.
 *
 * Named after the glossary's **Load state**, because three of those four are
 * literally one. It is not called `EmptyState`: two of its uses are failures,
 * and a name that misdescribes half its call sites is how the copies it
 * replaces drifted apart in the first place.
 *
 * Presentational — it knows what it is showing, never why.
 */
export function LoadMessage({
  title,
  body,
  action,
  className,
}: LoadMessageProps) {
  return (
    <Root className={className}>
      <Title>{title}</Title>
      <Body>{body}</Body>
      {action === undefined ? null : <Action>{action}</Action>}
    </Root>
  );
}
