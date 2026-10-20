import { Columns, List, ListHeading } from './GoesAndStays.styles';

export interface GoesAndStaysProps {
  /** **What goes**, in order, each line led by ✕. */
  goes: readonly string[];
  /** **What stays**, in order, each line led by ✓. */
  stays: readonly string[];
}

/**
 * **What goes** beside **What stays**, the two even columns both of the
 * Manage library page's dialogs draw: each heading over its list, What goes
 * in danger. Presentational: the words are the caller's.
 */
export function GoesAndStays({ goes, stays }: GoesAndStaysProps) {
  return (
    <Columns>
      <div>
        <ListHeading $goes>What goes</ListHeading>
        <List $goes>
          {goes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      </div>
      <div>
        <ListHeading $goes={false}>What stays</ListHeading>
        <List $goes={false}>
          {stays.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      </div>
    </Columns>
  );
}
