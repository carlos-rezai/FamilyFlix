import {
  Root,
  Credit,
  CastCredit,
  CreditLabel,
  CreditValue,
  CastValue,
} from './CreditsRow.styles';

export interface CreditsRowProps {
  /** The director, or "—" when the record has none. */
  director: string;
  /** The cast on one readable line, or "—" when the record has none. */
  castText: string;
  /** False only when **both** are missing, in which case nothing is drawn. */
  hasCredits: boolean;
}

/**
 * The **Credits row** under the synopsis: Director and Cast, side by side.
 *
 * Its one rule is asymmetric on purpose. One missing credit keeps its heading
 * and shows "—", because "we know who directed it and not who is in it" is
 * information; both missing drops the row entirely, because two dashes under
 * two headings is a row that says nothing while taking up the space of one that
 * does. Which case this is was already decided by `detailView` — this component
 * only has to honour it.
 */
export function CreditsRow({
  director,
  castText,
  hasCredits,
}: CreditsRowProps) {
  if (!hasCredits) {
    return null;
  }

  return (
    <Root>
      <Credit>
        <CreditLabel>Director</CreditLabel>
        <CreditValue>{director}</CreditValue>
      </Credit>
      <CastCredit>
        <CreditLabel>Cast</CreditLabel>
        <CastValue>{castText}</CastValue>
      </CastCredit>
    </Root>
  );
}
