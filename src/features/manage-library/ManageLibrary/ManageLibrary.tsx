import { useSearchParams } from 'react-router-dom';

import { PageHeader, PillTabs } from '@/components';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { TitleRow } from '../TitleRow/TitleRow';
import { tabSummary } from '../titleRowView/titleRowView';
import { useLibraryTitles } from '../useLibraryTitles/useLibraryTitles';
import { Empty, List, Summary, Toolbar } from './ManageLibrary.styles';

type Tab = 'movies' | 'series';

/**
 * The **Manage library page**'s organism: the maintainer header — Back onto
 * Settings, _Manage library_ and the lede — then, once the read lands, the
 * _Movies N_ / _Series N_ tabs (`tab` written as a replace, omitted at
 * movies) beside the summary, over one **Title row** per title of the tab, or
 * the empty card. **Blank until it lands**.
 */
export function ManageLibrary() {
  const { titles } = useLibraryTitles();
  const goBack = useGoBack('/settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'series' ? 'series' : 'movies';

  function choose(next: Tab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'movies') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    setSearchParams(params, { replace: true });
  }

  const shown = titles === null ? [] : titles[tab];

  return (
    <>
      <PageHeader
        onBack={goBack}
        heading="Manage library"
        lede="Every title in your library, and where its files are. Edit its details, clear them, or delete it for good."
      />

      {titles === null ? null : (
        <>
          <Toolbar>
            <PillTabs
              label="Kind"
              options={[
                { value: 'movies', label: `Movies ${titles.movies.length}` },
                { value: 'series', label: `Series ${titles.series.length}` },
              ]}
              value={tab}
              onChange={choose}
            />
            <Summary>
              {tabSummary(tab === 'movies' ? 'movie' : 'series', shown)}
            </Summary>
          </Toolbar>
          {shown.length === 0 ? (
            <Empty>
              {tab === 'movies'
                ? 'No movies in your library.'
                : 'No series in your library.'}
            </Empty>
          ) : (
            <List>
              {shown.map((title) => (
                <TitleRow key={title.id} title={title} />
              ))}
            </List>
          )}
        </>
      )}
    </>
  );
}
