import {
  Root,
  Credit,
  CastCredit,
  CreditLabel,
  CreditValue,
  CastValue,
} from './CreditsRow.styles';

export interface CreditsRowProps {
  /** The first credit's heading — _Director_ on a movie, _Created by_ on a series. */
  leadLabel: string;
  /** The first credit, or "—" when the record has none. */
  lead: string;
  /** The cast's heading; _Cast_ unless the page names another (_Starring_). */
  castLabel?: string;
  /** The cast on one readable line, or "—" when the record has none. */
  castText: string;
  /** False only when **both** are missing, in which case nothing is drawn. */
  hasCredits: boolean;
}

/**
 * The **Credits row** under the synopsis: the lead credit and the cast, side
 * by side.
 *
 * Its one rule is asymmetric on purpose. One missing credit keeps its heading
 * and shows "—", because "we know who made it and not who is in it" is
 * information; both missing drops the row entirely, because two dashes under
 * two headings is a row that says nothing while taking up the space of one that
 * does. Which case this is was already decided by the page's view mapper —
 * this component only has to honour it.
 */
export function CreditsRow({
  leadLabel,
  lead,
  castLabel = 'Cast',
  castText,
  hasCredits,
}: CreditsRowProps) {
  if (!hasCredits) {
    return null;
  }

  return (
    <Root>
      <Credit>
        <CreditLabel>{leadLabel}</CreditLabel>
        <CreditValue>{lead}</CreditValue>
      </Credit>
      <CastCredit>
        <CreditLabel>{castLabel}</CreditLabel>
        <CastValue>{castText}</CastValue>
      </CastCredit>
    </Root>
  );
}
