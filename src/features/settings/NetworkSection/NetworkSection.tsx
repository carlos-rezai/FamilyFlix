import { Button } from '@/primitives';

import { useTmdbKey } from '../useTmdbKey/useTmdbKey';
import { Card, GroupHeading, ItemTitle } from '../section.styles';
import {
  Head,
  KeyHint,
  KeyInput,
  KeyRow,
  Lede,
  StatusPill,
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
 */
export function NetworkSection() {
  const { key, connected, testing, onKey, test } = useTmdbKey();

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
      </Card>
    </>
  );
}
