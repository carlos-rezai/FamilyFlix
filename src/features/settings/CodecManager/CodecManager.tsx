import { CodecRow } from '../CodecRow/CodecRow';
import { codecRows, codecSummary } from '../codecView/codecView';
import { useCapabilities } from '../useCapabilities/useCapabilities';
import { Report, Rows, Summary } from './CodecManager.styles';

/**
 * The **Codec report**, `feat.CodecManager.dc.html` → `CodecManager`: the
 * organism that owns `useCapabilities` and draws the **Codec summary** over
 * one **Codec row** per catalogued codec the report contains, in catalogue
 * order.
 *
 * A report, not a manager: no _Add a codec pack_ zone and no ✕ until the
 * **Playback component upload** ships. The spec's `{ summaryLabel, codecs,
 * onBrowse }` props collapse the way `ExportModal`'s did — the organism reads
 * the wire itself.
 *
 * **Blank until it lands**: nothing at all while the report is `null`, and
 * nothing still on a refused read. No skeleton, no error face.
 */
export function CodecManager() {
  const { capabilities } = useCapabilities();

  if (capabilities === null) {
    return null;
  }

  return (
    <Report>
      <Summary>{codecSummary(capabilities)}</Summary>
      <Rows>
        {codecRows(capabilities).map((row) => (
          <CodecRow key={row.codec} row={row} />
        ))}
      </Rows>
    </Report>
  );
}
