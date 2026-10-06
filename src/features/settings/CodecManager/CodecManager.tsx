import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import { CodecRow } from '../CodecRow/CodecRow';
import { ComponentDropZone } from '../ComponentDropZone/ComponentDropZone';
import { codecRows, codecSummary, componentRow } from '../codecView/codecView';
import { useCapabilities } from '../useCapabilities/useCapabilities';
import {
  GroupCard,
  GroupHeading,
  HeaderRow,
  Heading,
  Lede,
  Rows,
  Summary,
} from './CodecManager.styles';

/**
 * The **Codecs page**'s screen, `feat.CodecManager.dc.html` → `CodecManager`:
 * the organism that owns `useCapabilities` and draws its own maintainer
 * header — the Back pill, the heading **Codecs** and the lede — the way
 * `ImportFlow` and `EnrichmentFlow` do. Back is the one **Back rule** with
 * Settings as the **Landing**.
 *
 * Under the header, two Settings groups on Settings' own furniture:
 *
 * - **Playback component** — the two inverses first, because they are the only
 *   things on the screen that change anything: the **Component row** (absent
 *   on a machine with no component at all), then the **Component drop zone**.
 *   The ✕ goes on the row **exactly when the report says the component is
 *   removable** — an **Uploaded component** and nothing else — and removes
 *   immediately, with no confirmation dialog.
 * - **Formats** — the **Codec summary** over one **Codec row** per catalogued
 *   codec, in catalogue order. The summary counts formats, never the
 *   component.
 *
 * The report the routes echo after a swap or a fall-back *is* the redraw: no
 * second read, no success flash. A refusal is drawn in the zone and nowhere
 * else.
 *
 * **Blank until it lands**: the header draws and nothing under it does while
 * the report is `null`, and nothing still on a refused read.
 */
export function CodecManager() {
  const { capabilities, upload, installComponent, removeComponent } =
    useCapabilities();
  const goBack = useGoBack('/settings');

  const component = capabilities === null ? null : componentRow(capabilities);

  return (
    <>
      <HeaderRow>
        <IconButton
          label="Back"
          title="Back"
          size={42}
          variant="outline"
          onClick={goBack}
        >
          <ChevronLeftIcon size={18} />
        </IconButton>
        <Heading>Codecs</Heading>
      </HeaderRow>
      <Lede>
        These decide which video files FamilyFlix can play. Common formats work
        out of the box — add a pack only if a movie won&apos;t play.
      </Lede>

      {capabilities === null ? null : (
        <>
          <GroupHeading>Playback component</GroupHeading>
          <GroupCard>
            {component !== null && (
              <CodecRow
                key={component.key}
                row={component}
                onRemove={
                  component.removable
                    ? () => {
                        void removeComponent();
                      }
                    : undefined
                }
              />
            )}
            <ComponentDropZone
              upload={upload}
              onFiles={(files) => {
                void installComponent(files);
              }}
            />
          </GroupCard>

          <GroupHeading>Formats</GroupHeading>
          <GroupCard $last>
            <Summary>{codecSummary(capabilities)}</Summary>
            <Rows>
              {codecRows(capabilities).map((row) => (
                <CodecRow key={row.key} row={row} />
              ))}
            </Rows>
          </GroupCard>
        </>
      )}
    </>
  );
}
