import { Family, Flix, Root } from './Wordmark.styles';

export interface WordmarkProps {
  /** Set by `styled(Wordmark)` — the caller's size, gap and spacing. */
  className?: string;
}

/**
 * The FamilyFlix **Wordmark**: _Family_ in the text ink, _Flix_ in the accent,
 * serif 700, sized by its parent's `font-size`. The header's logo, the About
 * card's brand row and the **Default poster** all draw this one mark.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <Root className={className}>
      <Family>Family</Family>
      <Flix>Flix</Flix>
    </Root>
  );
}
