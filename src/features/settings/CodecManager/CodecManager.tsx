import { CodecRow } from '../CodecRow/CodecRow';
import { ComponentDropZone } from '../ComponentDropZone/ComponentDropZone';
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
 * Under everything, the **Component drop zone**: the dashed box the two
 * **Component binaries** are dropped on, and the write behind it. The report
 * the route echoes after the swap *is* the redraw — the _Installed_ rows
 * appear, the summary recounts and the **Component row**'s pill flips to
 * **Uploaded**, with no second read and no success flash. A refusal is drawn
 * in the zone and nowhere else, and the rows stay exactly as they were.
 *
 * Still no ✕: removing is Phase 4's, so nothing here passes a remove handler.
 * The spec's `{ summaryLabel, codecs, onBrowse }` props collapse the way
 * `ExportModal`'s did — the organism reads the wire itself.
 *
 * **Blank until it lands**: nothing at all while the report is `null`, and
 * nothing still on a refused read. No skeleton, no error face.
 */
export function CodecManager() {
  const { capabilities, upload, installComponent } = useCapabilities();

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
      <ComponentDropZone
        upload={upload}
        onFiles={(files) => {
          void installComponent(files);
        }}
      />
    </Report>
  );
}
