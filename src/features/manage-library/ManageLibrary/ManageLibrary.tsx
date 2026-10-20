import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useSnackbar } from '@/App/useSnackbar/useSnackbar';

import { PageHeader, PillTabs } from '@/components';
import type { LibraryTitle } from '@/types';
import { ClearDialog } from '../ClearDialog/ClearDialog';
import { DeleteTitleDialog } from '../DeleteTitleDialog/DeleteTitleDialog';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { useQueryParamWriter } from '@/hooks/useQueryParamWriter/useQueryParamWriter';
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
 * the empty card. **Blank until it lands**. A row's _Clear details_ opens
 * the **Clear dialog**; a clear that lands closes it, the row redrawn from
 * the echo, with the `success` notice. A refused one leaves it open, live.
 * _Delete…_ opens the **Delete dialog** the same way: a delete that lands
 * closes it, the row off the list, with _“Coco” was deleted._
 */
export function ManageLibrary() {
  const { titles, clearDetails, deleteTitle, deleteRefusal } =
    useLibraryTitles();
  const { notify } = useSnackbar();
  const [asked, setAsked] = useState<LibraryTitle | null>(null);
  const [clearing, setClearing] = useState(false);

  async function confirmClear(title: LibraryTitle) {
    setClearing(true);
    const cleared = await clearDetails(title);
    setClearing(false);
    if (cleared) {
      setAsked(null);
      notify({
        variant: 'success',
        message: `Details cleared for “${title.title}”.`,
      });
    }
  }
  const [doomed, setDoomed] = useState<LibraryTitle | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete(title: LibraryTitle) {
    setDeleting(true);
    const deleted = await deleteTitle(title);
    setDeleting(false);
    if (deleted) {
      setDoomed(null);
      notify({ variant: 'success', message: `“${title.title}” was deleted.` });
    }
  }
  const goBack = useGoBack('/settings');
  const [searchParams] = useSearchParams();
  const setParam = useQueryParamWriter();
  const tab: Tab = searchParams.get('tab') === 'series' ? 'series' : 'movies';

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
              onChange={(next) => setParam('tab', next, 'movies')}
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
                <TitleRow
                  key={title.id}
                  title={title}
                  onClear={setAsked}
                  onDelete={setDoomed}
                />
              ))}
            </List>
          )}
        </>
      )}

      {asked === null ? null : (
        <ClearDialog
          title={asked}
          clearing={clearing}
          onConfirm={() => void confirmClear(asked)}
          onClose={() => setAsked(null)}
        />
      )}

      {doomed === null ? null : (
        <DeleteTitleDialog
          title={doomed}
          deleting={deleting}
          refusal={deleteRefusal}
          onConfirm={() => void confirmDelete(doomed)}
          onClose={() => setDoomed(null)}
        />
      )}
    </>
  );
}
