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
  sfMatchFields: string[];
  nsMatchFields: string[];
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
  // Salesforce returns a queryMore cursor on page 1; we follow it instead of using
  // OFFSET, which is capped at 2000 for Account and several other SF objects.
  let cursor: string | undefined;

  for (let page = 1; rows.length < cap; page++) {
    onPage?.(page, rows.length);
    const result = await connectorClient.query(
      creds.type as ConnectionType,
      creds.credentials,
      query,
      { page, pageSize: PAGE_SIZE, cursor }
    );
    rows.push(...(result.rows as Record<string, unknown>[]));
    cursor = result.nextCursor;

    // hasMore is the most reliable signal (NS SuiteQL provides it natively).
    if (result.hasMore === false) break;
    // Cursor exhausted + no hasMore signal — use short-page detection.
    if (!cursor && result.hasMore === undefined && result.rows.length < PAGE_SIZE) break;
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

// Build a composite key from multiple field values joined with a null-byte separator.
// Null bytes are extremely unlikely in real data, making them safe as a key separator.
function compositeKey(row: Record<string, unknown>, fields: string[]): string {
  return fields.map((f) => String(row[f] ?? '').trim()).join('\0');
}

// Pure synchronous match computation — call this after fetching rows separately.
// Returns ALL matched/unmatched rows; clients do their own display-level slicing.
// Supports composite keys (AND) and per-field OR matching.
export function computeMatchesFromRows(
  sfRows: Record<string, unknown>[],
  nsRows: Record<string, unknown>[],
  sfFields: string[],
  nsFields: string[],
  condition: 'AND' | 'OR' = 'AND'
): PairResult {
  const matchedPairs: Array<{ sfRecord: Record<string, unknown>; nsRecord: Record<string, unknown> }> = [];
  const unmatchedSfRecords: Record<string, unknown>[] = [];
  const matchedNsObjects = new Set<Record<string, unknown>>();

  if (condition === 'OR') {
    // Build one lookup map per field index: NS field[i] value → first NS row with that value
    const nsMaps: Map<string, Record<string, unknown>>[] = sfFields.map((_, i) => {
      const m = new Map<string, Record<string, unknown>>();
      for (const row of nsRows) {
        const val = String(row[nsFields[i]] ?? '').trim();
        if (val) m.set(val, row);
      }
      return m;
    });

    for (const sfRow of sfRows) {
      let matchedNsRow: Record<string, unknown> | undefined;
      for (let i = 0; i < sfFields.length; i++) {
        const sfVal = String(sfRow[sfFields[i]] ?? '').trim();
        if (sfVal && nsMaps[i].has(sfVal)) {
          matchedNsRow = nsMaps[i].get(sfVal);
          break;
        }
      }
      if (matchedNsRow) {
        matchedPairs.push({ sfRecord: sfRow, nsRecord: matchedNsRow });
        matchedNsObjects.add(matchedNsRow);
      } else {
        unmatchedSfRecords.push(sfRow);
      }
    }
  } else {
    // AND: composite key — all fields must match simultaneously
    const nsMap = new Map<string, Record<string, unknown>>();
    for (const row of nsRows) {
      const key = compositeKey(row, nsFields);
      if (key.replace(/\0/g, '').trim()) nsMap.set(key, row);
    }
    const matchedNsKeys = new Set<string>();

    for (const sfRow of sfRows) {
      const key = compositeKey(sfRow, sfFields);
      if (key.replace(/\0/g, '').trim() && nsMap.has(key)) {
        const nsRow = nsMap.get(key)!;
        matchedPairs.push({ sfRecord: sfRow, nsRecord: nsRow });
        matchedNsKeys.add(key);
        matchedNsObjects.add(nsRow);
      } else {
        unmatchedSfRecords.push(sfRow);
      }
    }
  }

  const unmatchedNsRecords = nsRows.filter((row) => !matchedNsObjects.has(row));

  return {
    sfTotal: sfRows.length,
    nsTotal: nsRows.length,
    matchedCount: matchedPairs.length,
    unmatchedSfCount: unmatchedSfRecords.length,
    unmatchedNsCount: unmatchedNsRecords.length,
    sfMatchFields: sfFields,
    nsMatchFields: nsFields,
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
  return computeMatchesFromRows(sfRows, nsRows, [sfField], [nsField]);
}
