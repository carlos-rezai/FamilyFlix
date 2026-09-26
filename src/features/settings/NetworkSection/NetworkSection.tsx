import { useNavigate } from 'react-router-dom';

import { useEnrichmentSummary } from '@/hooks/useEnrichmentSummary/useEnrichmentSummary';
import { Button, ChevronRightIcon, SyncIcon } from '@/primitives';

import { syncLine } from '../syncLine/syncLine';
import { useTmdbKey } from '../useTmdbKey/useTmdbKey';
import { Card, GroupHeading, ItemTitle } from '../section.styles';
import {
  Head,
  KeyHint,
  KeyInput,
  KeyRow,
  Lede,
  StatusPill,
  SyncChevron,
  SyncDesc,
  SyncDivider,
  SyncLabel,
  SyncRow,
  SyncText,
  SyncTile,
  TitleRow,
} from './NetworkSection.styles';

/** What the button says: asking, connected, or not yet. */
function testLabel(testing: boolean, connected: boolean): string {
  if (testing) {
    return 'Testing…';
  }
  return connected ? 'Test again' : 'Test connection';
}

/**
 * The Settings hub's Network **Settings group**, from
 * `page.SettingsPage.dc.html`: the one place FamilyFlix goes online. _The
 * Movie Database (TMDB)_ with its status pill, the lede, the masked key field
 * in mono beside _Test connection_, and the hint under it.
 *
 * The section owns `useTmdbKey`: the stored key comes back masked in the
 * field, the pill reads _Connected_ while it is there and _Not set up_ the
 * moment it is edited, and _Test connection_ tests and saves in one.
 *
 * Under a divider, _Sync metadata & posters_ pushes `/enrich`; its line is
 * `syncLine` over the `EnrichmentSummary`, blank until the read lands.
 */
export function NetworkSection() {
  const { key, connected, testing, onKey, test } = useTmdbKey();
  const { summary } = useEnrichmentSummary();
  const navigate = useNavigate();

  return (
    <>
      <GroupHeading>Network</GroupHeading>
      <Card>
        <Head>
          <TitleRow>
            <ItemTitle>The Movie Database (TMDB)</ItemTitle>
            <StatusPill $connected={connected}>
              {connected ? 'Connected' : 'Not set up'}
            </StatusPill>
          </TitleRow>
          <Lede>
            The only part of FamilyFlix that goes online. Nothing is sent about
            your household — just movie titles, to look up posters and synopses.
          </Lede>
        </Head>
        <KeyRow>
          <KeyInput
            type="password"
            value={key}
            placeholder="Paste your TMDB API key"
            aria-label="TMDB API key"
            onChange={(event) => onKey(event.target.value)}
          />
          <Button
            label={testLabel(testing, connected)}
            variant="secondary"
            size="md"
            onClick={() => void test()}
          />
        </KeyRow>
        <KeyHint>
          {connected
            ? 'Key saved on this machine. It is never shared or uploaded anywhere else.'
            : 'Get a free key at themoviedb.org → Settings → API.'}
        </KeyHint>
        <SyncDivider />
        <SyncRow type="button" onClick={() => navigate('/enrich')}>
          <SyncTile aria-hidden="true">
            <SyncIcon size={19} />
          </SyncTile>
          <SyncText>
            <SyncLabel>Sync metadata &amp; posters</SyncLabel>
            <SyncDesc>
              {summary === null ? '' : syncLine(summary, new Date())}
            </SyncDesc>
          </SyncText>
          <SyncChevron>
            <ChevronRightIcon size={18} />
          </SyncChevron>
        </SyncRow>
      </Card>
    </>
  );
}
