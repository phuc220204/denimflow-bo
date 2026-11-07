import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import {
  fetchAllowedColors,
  fetchColorOptions,
  fetchFabricTypes,
  fetchMatrix,
  fetchStations,
  fetchStyleQcProfiles,
  fetchStyles,
  fetchWashTypes,
} from './api';

// The API requires a login on every catalog route (#28); a read without the bearer token gets
// 401 and the page shows an error instead of the list.
describe('catalog reads send the login token (FR-01, FR-02)', () => {
  const reads: [string, () => Promise<unknown>][] = [
    ['fetchStations', () => fetchStations('token-123')],
    ['fetchStyles', () => fetchStyles('token-123')],
    ['fetchFabricTypes', () => fetchFabricTypes('token-123')],
    ['fetchColorOptions', () => fetchColorOptions('token-123')],
    ['fetchWashTypes', () => fetchWashTypes('token-123')],
    ['fetchMatrix', () => fetchMatrix('token-123')],
    ['fetchAllowedColors', () => fetchAllowedColors('fabric-1', 'token-123')],
    ['fetchStyleQcProfiles', () => fetchStyleQcProfiles('style-1', 'token-123')],
  ];

  it.each(reads)('%s sends Authorization: Bearer <token>', async (_name, read) => {
    let seen: string | null = null;
    server.use(
      http.get('*/catalog/*', ({ request }) => {
        seen = request.headers.get('Authorization');
        return seen ? HttpResponse.json([]) : new HttpResponse(null, { status: 401 });
      }),
    );

    await read();

    expect(seen).toBe('Bearer token-123');
  });
});
