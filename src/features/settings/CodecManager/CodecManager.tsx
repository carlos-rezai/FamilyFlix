import { CodecRow } from '../CodecRow/CodecRow';
import { codecRows, codecSummary, componentRow } from '../codecView/codecView';
import { useCapabilities } from '../useCapabilities/useCapabilities';
import { Report, Rows, Summary } from './CodecManager.styles';

/**
 * The **Codec report**, `feat.CodecManager.dc.html` → `CodecManager`: the
 * organism that owns `useCapabilities` and draws the **Codec summary** over
 * one **Codec row** per catalogued codec the report contains, in catalogue
 * order.
 *
 * Under them, **last**, the **Component row**: the one row that has a size
 * and a source — the ffmpeg pair the player actually converts with — and
 * absent on a machine with no component at all. It never enters the **Codec
 * summary**'s count: the line says how many films play, and the pair is not a
 * film format.
 *
 * A report, not a manager: no _Add a codec pack_ zone and no ✕ until the rest
 * of the **Playback component upload** ships, so nothing here passes a remove
 * handler. The spec's `{ summaryLabel, codecs, onBrowse }` props collapse the
 * way `ExportModal`'s did — the organism reads the wire itself.
 *
 * **Blank until it lands**: nothing at all while the report is `null`, and
 * nothing still on a refused read. No skeleton, no error face.
 */
export function CodecManager() {
  const { capabilities } = useCapabilities();

  if (capabilities === null) {
    return null;
  }

  const component = componentRow(capabilities);

  return (
    <Report>
      <Summary>{codecSummary(capabilities)}</Summary>
      <Rows>
        {codecRows(capabilities).map((row) => (
          <CodecRow key={row.key} row={row} />
        ))}
        {component !== null && <CodecRow key={component.key} row={component} />}
      </Rows>
    </Report>
  );
}
