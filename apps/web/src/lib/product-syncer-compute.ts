import { connectorClient } from '@/lib/connector-client';
import type { ConnectionType, RawCredentials } from '@/types/connection';

const PAGE_SIZE = 500;
// Hard ceiling to prevent runaway fetches on very large orgs
const SAFETY_CAP = 100_000;

export type ConnCreds = { credentials: RawCredentials; type: string };

export interface PairResult {
  sfTotal: number;
  nsTotal: number;
  matchedCount: number;
  unmatchedSfCount: number;
  unmatchedNsCount: number;
  sfMatchField: string;
  nsMatchField: string;
  matchedPairs: Array<{ sfRecord: Record<string, unknown>; nsRecord: Record<string, unknown> }>;
  unmatchedSfRecords: Record<string, unknown>[];
  unmatchedNsRecords: Record<string, unknown>[];
}

export interface FetchOptions {
  filter?: string;
  limit?: number;
  onPage?: (page: number, count: number) => void;
}

export async function fetchAllRecordsByQuery(
  creds: ConnCreds,
  query: string,
  options: FetchOptions = {}
): Promise<Record<string, unknown>[]> {
  const { limit, onPage } = options;
  const cap = limit ?? SAFETY_CAP;
  const rows: Record<string, unknown>[] = [];

  for (let page = 1; rows.length < cap; page++) {
    onPage?.(page, rows.length);
    const result = await connectorClient.query(
      creds.type as ConnectionType,
      creds.credentials,
      query,
      { page, pageSize: PAGE_SIZE }
    );
    rows.push(...(result.rows as Record<string, unknown>[]));

    // hasMore is the most reliable signal (NS SuiteQL provides it natively).
    // Fall back to short-page detection when hasMore is absent (e.g. Salesforce SOQL).
    if (result.hasMore === false) break;
    if (result.hasMore === undefined && result.rows.length < PAGE_SIZE) break;
    // total is only reliable when it exceeds page size (NS SuiteQL total = page count)
    if (result.total > PAGE_SIZE && rows.length >= result.total) break;
  }

  return limit ? rows.slice(0, limit) : rows;
}

export async function fetchAllRecords(
  creds: ConnCreds,
  objectName: string,
  options: FetchOptions = {}
): Promise<Record<string, unknown>[]> {
  const { filter, limit, onPage } = options;
  const cap = limit ?? SAFETY_CAP;
  const rows: Record<string, unknown>[] = [];
  // Salesforce caps SOQL OFFSET at 2000 for some objects (e.g. PricebookEntry).
  // Use streamMode on page 1 (no LIMIT/OFFSET) so Salesforce returns a queryMore
  // cursor in nextCursor, then follow it on subsequent pages — no OFFSET needed.
  const useCursorFlow = creds.type === 'salesforce';
  let cursor: string | undefined;

  for (let page = 1; rows.length < cap; page++) {
    onPage?.(page, rows.length);
    const result = await connectorClient.data(
      creds.type as ConnectionType,
      creds.credentials,
      objectName,
      {
        page,
        pageSize: PAGE_SIZE,
        ...(filter && !cursor ? { filter } : {}),
        ...(cursor ? { cursor } : {}),
        ...(useCursorFlow && !cursor ? { streamMode: true } : {}),
      }
    );
    rows.push(...(result.rows as Record<string, unknown>[]));
    cursor = result.nextCursor;

    // No cursor + short page = last page (works for all connectors).
    if (!cursor && result.rows.length < PAGE_SIZE) break;
    // Total is reliable when > PAGE_SIZE (NS SuiteQL returns total ≤ PAGE_SIZE).
    if (result.total > PAGE_SIZE && rows.length >= result.total) break;
  }

  return limit ? rows.slice(0, limit) : rows;
}

// Pure synchronous match computation — call this after fetching rows separately.
// Returns ALL matched/unmatched rows; clients do their own display-level slicing.
export function computeMatchesFromRows(
  sfRows: Record<string, unknown>[],
  nsRows: Record<string, unknown>[],
  sfField: string,
  nsField: string
): PairResult {
  const nsMap = new Map<string, Record<string, unknown>>();
  for (const row of nsRows) {
    const key = String(row[nsField] ?? '').trim();
    if (key) nsMap.set(key, row);
  }

  const matchedPairs: Array<{ sfRecord: Record<string, unknown>; nsRecord: Record<string, unknown> }> = [];
  const unmatchedSfRecords: Record<string, unknown>[] = [];
  const matchedNsKeys = new Set<string>();

  for (const sfRow of sfRows) {
    const key = String(sfRow[sfField] ?? '').trim();
    if (key && nsMap.has(key)) {
      matchedPairs.push({ sfRecord: sfRow, nsRecord: nsMap.get(key)! });
      matchedNsKeys.add(key);
    } else {
      unmatchedSfRecords.push(sfRow);
    }
  }

  const unmatchedNsRecords = nsRows.filter((row) => {
    const key = String(row[nsField] ?? '').trim();
    return !matchedNsKeys.has(key);
  });

  return {
    sfTotal: sfRows.length,
    nsTotal: nsRows.length,
    matchedCount: matchedPairs.length,
    unmatchedSfCount: unmatchedSfRecords.length,
    unmatchedNsCount: unmatchedNsRecords.length,
    sfMatchField: sfField,
    nsMatchField: nsField,
    matchedPairs,
    unmatchedSfRecords,
    unmatchedNsRecords,
  };
}

// Convenience wrapper used by the Gemini analyze route (no streaming needed there).
export async function computeMatchAnalysis(
  sf: ConnCreds,
  ns: ConnCreds,
  sfObject: string,
  nsObject: string,
  sfField: string,
  nsField: string
): Promise<PairResult> {
  const [sfRows, nsRows] = await Promise.all([
    fetchAllRecords(sf, sfObject),
    fetchAllRecords(ns, nsObject),
  ]);
  return computeMatchesFromRows(sfRows, nsRows, sfField, nsField);
}
