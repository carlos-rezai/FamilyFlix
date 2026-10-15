import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  applyChoices,
  cancelEnrichment,
  dismissDecision,
  dismissDecisions,
  EnrichmentBusyError,
  fetchCurrentEnrichment,
  pickCandidate,
  saveSeasonPoster,
  searchDecision,
  startEnrichment,
} from './api';
import type { Decision, SeasonChoice, StartEnrichment } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import {
  conflictResponse,
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: the enrichment `api/` has a
 * suite, the import-export one's precedent.
 *
 * The wire calls the run hook makes — one caller each, so they live with the
 * feature. What each sends, and what its caller is handed for each status the
 * route can answer: a start's `201` and its `409` as `EnrichmentBusyError`,
 * the current run's `404` as `null`, and the Decision writes' `204`s.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sent = () => {
  const [input, init] = fetchMock.mock.calls[0] ?? [];
  return {
    url: String(input),
    method: (init?.method ?? 'GET').toUpperCase(),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
};

const OPTIONS: StartEnrichment = {
  scope: 'single',
  movieId: 'm1',
  fields: ['synopsis', 'poster'],
  writeSheet: false,
  writePosters: true,
};

const DECISION: Decision = {
  id: 'd/1',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched “Sundial 2004”.',
  path: null,
  query: 'Sundial 2004',
};

describe('startEnrichment', () => {
  it('POSTs the options to /api/enrichment and resolves the run', async () => {
    const run = makeEnrichmentRun({ scope: 'single', total: 1 });
    fetchMock.mockResolvedValue(createdResponse(run));

    await expect(startEnrichment(OPTIONS)).resolves.toEqual(run);
    expect(sent()).toEqual({
      url: '/api/enrichment',
      method: 'POST',
      body: OPTIONS,
    });
  });

  it('rejects with EnrichmentBusyError on a 409', async () => {
    fetchMock.mockResolvedValue(conflictResponse());

    await expect(startEnrichment(OPTIONS)).rejects.toBeInstanceOf(
      EnrichmentBusyError
    );
  });

  it('rejects with a plain Error on anything else', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const refusal = startEnrichment(OPTIONS);
    await expect(refusal).rejects.toThrow('POST /api/enrichment failed: 500');
    await expect(refusal).rejects.not.toBeInstanceOf(EnrichmentBusyError);
  });
});

describe('fetchCurrentEnrichment', () => {
  it('GETs the current run', async () => {
    const run = makeEnrichmentRun();
    fetchMock.mockResolvedValue(okResponse(run));

    await expect(fetchCurrentEnrichment()).resolves.toEqual(run);
    expect(sent()).toMatchObject({
      url: '/api/enrichment/current',
      method: 'GET',
    });
  });

  it('resolves null on a 404 — no run is a state', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No sync is running'));

    await expect(fetchCurrentEnrichment()).resolves.toBeNull();
  });

  it('rejects on anything else', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchCurrentEnrichment()).rejects.toThrow();
  });
});

describe('cancelEnrichment', () => {
  it('POSTs the cancel and resolves on a 204', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(cancelEnrichment()).resolves.toBeUndefined();
    expect(sent()).toMatchObject({
      url: '/api/enrichment/current/cancel',
      method: 'POST',
    });
  });

  it('rejects when the route refuses', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(cancelEnrichment()).rejects.toThrow();
  });
});

describe('the Decision writes', () => {
  it('searchDecision POSTs the query and resolves the Decision', async () => {
    fetchMock.mockResolvedValue(okResponse(DECISION));

    await expect(searchDecision('d/1', 'Sundial 2004')).resolves.toEqual(
      DECISION
    );
    expect(sent()).toEqual({
      url: '/api/enrichment/current/decisions/d%2F1/search',
      method: 'POST',
      body: { query: 'Sundial 2004' },
    });
  });

  it('pickCandidate POSTs the TMDB id', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(pickCandidate('d1', 601)).resolves.toBeUndefined();
    expect(sent()).toEqual({
      url: '/api/enrichment/current/decisions/d1/pick',
      method: 'POST',
      body: { tmdbId: 601 },
    });
  });

  it('applyChoices POSTs the choices', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(
      applyChoices('d1', { year: 'tmdb', director: 'mine' })
    ).resolves.toBeUndefined();
    expect(sent()).toEqual({
      url: '/api/enrichment/current/decisions/d1/apply',
      method: 'POST',
      body: { choices: { year: 'tmdb', director: 'mine' } },
    });
  });

  it('dismissDecision DELETEs the row', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(dismissDecision('d1')).resolves.toBeUndefined();
    expect(sent()).toMatchObject({
      url: '/api/enrichment/current/decisions/d1',
      method: 'DELETE',
    });
  });

  it.each([
    ['searchDecision', () => searchDecision('d1', 'x')],
    ['pickCandidate', () => pickCandidate('d1', 1)],
    ['applyChoices', () => applyChoices('d1', {})],
    ['dismissDecision', () => dismissDecision('d1')],
  ])('%s rejects when the route refuses', async (_name, call) => {
    fetchMock.mockResolvedValue(notFoundResponse('No such decision'));

    await expect(call()).rejects.toThrow();
  });
});

// 42 — Review at scale refactor (issue #366): _Skip all_'s call and the
// **Season choice**'s — each its JSON body, and the route's `200` echo.

describe('dismissDecisions', () => {
  it('POSTs the ids as JSON to the bulk dismiss route', async () => {
    fetchMock.mockResolvedValue(okResponse(makeEnrichmentRun()));

    await dismissDecisions(['d1', 'd2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual({
      url: '/api/enrichment/current/decisions/dismiss',
      method: 'POST',
      body: { ids: ['d1', 'd2'] },
    });
  });

  it('answers the run the route echoes on a 200', async () => {
    const run = makeEnrichmentRun({ phase: 'review' });
    fetchMock.mockResolvedValue(okResponse(run));

    await expect(dismissDecisions(['d1'])).resolves.toEqual(run);
  });

  it.each([
    ['a 404', notFoundResponse('No current run')],
    ['a 500', serverErrorResponse()],
  ])('rejects on %s', async (_, response) => {
    fetchMock.mockResolvedValue(response);

    await expect(dismissDecisions(['d1'])).rejects.toThrow();
  });
});

describe('saveSeasonPoster', () => {
  const CHOICE: SeasonChoice = {
    season: 2,
    posterUrl: '/api/images/the-hollow-coast-2018/S02-poster.jpg',
    choices: [],
  };

  it('POSTs the path as JSON to the season’s poster route', async () => {
    fetchMock.mockResolvedValue(okResponse(CHOICE));

    await saveSeasonPoster(2, '/s02-a.jpg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual({
      url: '/api/enrichment/current/seasons/2/poster',
      method: 'POST',
      body: { path: '/s02-a.jpg' },
    });
  });

  it('answers the season’s choice the route echoes on a 200', async () => {
    fetchMock.mockResolvedValue(okResponse(CHOICE));

    await expect(saveSeasonPoster(2, '/s02-a.jpg')).resolves.toEqual(CHOICE);
  });

  it.each([
    ['a 404', notFoundResponse('No sync holds that season.')],
    ['a 500', serverErrorResponse()],
  ])('rejects on %s', async (_, response) => {
    fetchMock.mockResolvedValue(response);

    await expect(saveSeasonPoster(2, '/s02-a.jpg')).rejects.toThrow();
  });
});
