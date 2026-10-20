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
import { emptyLine, tabSummary } from '../libraryTitleView/libraryTitleView';
import { useLibraryTitles } from '../useLibraryTitles/useLibraryTitles';
import { Empty, List, Summary, Toolbar } from './ManageLibrary.styles';

/**
 * The **Manage library page**'s organism: the maintainer header — Back onto
 * Settings, _Manage library_ and the lede — then, once the read lands, the
 * _Movies N_ / _Series N_ tabs (`tab` written as a replace, omitted at
 * movies) beside the summary, over one **Title row** per title of the tab, or
 * the empty card. **Blank until it lands**. A row's _Clear details_ opens
 * the **Clear dialog**; a clear that lands closes it, the row redrawn from
 * the echo, with the `success` notice. A refused one leaves it open, live.
 * _Delete…_ opens the **Delete dialog** the same way: a delete that lands
 * closes it, the row off the list, with _“Coco” was deleted._ The in-flight
 * states and the refusal — held against its title — are `useLibraryTitles`';
 * the organism holds only which dialog is open, and for which title.
 */
export function ManageLibrary() {
  const { titles, clearing, clearDetails, deleting, deleteTitle, refusalFor } =
    useLibraryTitles();
  const { notify } = useSnackbar();
  const [asked, setAsked] = useState<LibraryTitle | null>(null);

  async function confirmClear(title: LibraryTitle) {
    const cleared = await clearDetails(title);
    if (cleared) {
      setAsked(null);
      notify({
        variant: 'success',
        message: `Details cleared for “${title.title}”.`,
      });
    }
  }
  const [doomed, setDoomed] = useState<LibraryTitle | null>(null);

  async function confirmDelete(title: LibraryTitle) {
    const deleted = await deleteTitle(title);
    if (deleted) {
      setDoomed(null);
      notify({ variant: 'success', message: `“${title.title}” was deleted.` });
    }
  }
  const goBack = useGoBack('/settings');
  const [searchParams] = useSearchParams();
  const setParam = useQueryParamWriter();
  const kind: LibraryTitle['kind'] =
    searchParams.get('tab') === 'series' ? 'series' : 'movie';

  const shown =
    titles === null ? [] : kind === 'movie' ? titles.movies : titles.series;

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
                { value: 'movie', label: `Movies ${titles.movies.length}` },
                { value: 'series', label: `Series ${titles.series.length}` },
              ]}
              value={kind}
              onChange={(next) =>
                setParam(
                  'tab',
                  next === 'movie' ? 'movies' : 'series',
                  'movies'
                )
              }
            />
            <Summary>{tabSummary(kind, shown)}</Summary>
          </Toolbar>
          {shown.length === 0 ? (
            <Empty>{emptyLine(kind)}</Empty>
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
          refusal={refusalFor(doomed)}
          onConfirm={() => void confirmDelete(doomed)}
          onClose={() => setDoomed(null)}
        />
      )}
    </>
  );
}
