import { Toggle } from '@/primitives';
import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';

import { Card, GroupHeading, Row, RowDesc, RowTitle } from '../section.styles';

/**
 * The Settings hub's Display **Settings group**: the `Display` **Group
 * heading** over one **Section card** holding a single row — _Ultrawide
 * margins_, its line, and the `Toggle` on the right, reading and writing
 * through `useDisplayPreference`, so the **Content frame** follows a press at
 * once. The Toggle is not drawn while the value is `null` — **Blank until it
 * lands**.
 */
export function DisplaySection() {
  const { ultrawideMargins, setUltrawideMargins } = useDisplayPreference();

  return (
    <>
      <GroupHeading>Display</GroupHeading>
      <Card>
        <Row $last>
          <div>
            <RowTitle>Ultrawide margins</RowTitle>
            <RowDesc>
              Keep everything in the middle of a very wide screen, so the rows
              fit without turning your head. Smaller screens look the same
              either way.
            </RowDesc>
          </div>
          {ultrawideMargins === null ? null : (
            <Toggle
              checked={ultrawideMargins}
              label="Ultrawide margins"
              onToggle={() => {
                void setUltrawideMargins(!ultrawideMargins);
              }}
            />
          )}
        </Row>
      </Card>
    </>
  );
}
