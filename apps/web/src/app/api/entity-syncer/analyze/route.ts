import { NextResponse } from 'next/server';
import { runAgenticLoop } from '@/lib/ai-providers';
import type { ToolParam } from '@/lib/ai-providers';
import { getDecryptedCredentials } from '@/models/Connection';
import { connectorClient } from '@/lib/connector-client';
import { computeMatchAnalysis } from '@/lib/entity-syncer-compute';
import type { PairResult } from '@/lib/entity-syncer-compute';
import type { ConnectionType, RawCredentials } from '@/types/connection';

export type { PairResult as AnalysisResult } from '@/lib/entity-syncer-compute';

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a data sync analyst for the QTC Syncer platform. Your job is to analyze how well Salesforce records match NetSuite records.

Salesforce is the source of truth. NetSuite may have additional records beyond what's synced from Salesforce.

Your workflow:
1. Call get_schemas to retrieve available fields from both objects.
2. Identify 2–3 candidate field pairs likely to serve as a matching key (e.g. product code, SKU, external ID, name).
3. Present your candidates with brief reasoning and ask the user which pair to use.
4. Once the user confirms, call compute_match_analysis with that field pair.
5. Summarize the results clearly: total records each side, matched count, unmatched count, and what the unmatched Salesforce records represent (products not yet in NetSuite).

Be concise. When suggesting candidates, show them as a numbered list. Never call compute_match_analysis without user confirmation of the field pair.`;

const TOOLS: ToolParam[] = [
  {
    name: 'get_schemas',
    description: 'Fetch field metadata for Salesforce Product2 and NetSuite item to identify candidate matching columns.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'compute_match_analysis',
    description: 'Fetch all records from both systems and compute exact-value matches on a chosen field pair. Returns totals, match counts, matched pairs, and unmatched Salesforce records.',
    parameters: {
      type: 'object',
      properties: {
        sf_field: {
          type: 'string',
          description: 'Salesforce Product2 field name to match on (API name, e.g. "ProductCode")',
        },
        ns_field: {
          type: 'string',
          description: 'NetSuite item field name to match on (API name, e.g. "itemid")',
        },
      },
      required: ['sf_field', 'ns_field'],
    },
  },
];

type Creds = { credentials: RawCredentials; type: string };

async function executeGetSchemas(sf: Creds, ns: Creds, sfObject: string, nsObject: string) {
  const [sfSchema, nsSchema] = await Promise.all([
    connectorClient.schema(sf.type as ConnectionType, sf.credentials, sfObject),
    connectorClient.schema(ns.type as ConnectionType, ns.credentials, nsObject),
  ]);
  return {
    salesforce_product2_fields: sfSchema.fields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
    netsuite_item_fields: nsSchema.fields.map((f) => ({ name: f.name, label: f.label, type: f.type })),
  };
}

async function executeComputeMatchAnalysis(sf: Creds, ns: Creds, sfObject: string, nsObject: string, sfField: string, nsField: string) {
  const raw = await computeMatchAnalysis(sf, ns, sfObject, nsObject, sfField, nsField);
  return {
    sf_total: raw.sfTotal,
    ns_total: raw.nsTotal,
    matched_count: raw.matchedCount,
    unmatched_sf_count: raw.unmatchedSfCount,
    unmatched_ns_count: raw.unmatchedNsCount,
    sf_match_fields: raw.sfMatchFields,
    ns_match_fields: raw.nsMatchFields,
    matched_pairs: raw.matchedPairs,
    unmatched_sf_records: raw.unmatchedSfRecords,
    unmatched_ns_records: raw.unmatchedNsRecords,
  };
}

export async function POST(req: Request) {
  try {
    const { messages, sfConnectionId, sfObject, nsConnectionId, nsObject } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      sfConnectionId: string;
      sfObject: string;
      nsConnectionId: string;
      nsObject: string;
    };

    const [sfCreds, nsCreds] = await Promise.all([
      getDecryptedCredentials(sfConnectionId),
      getDecryptedCredentials(nsConnectionId),
    ]);

    if (!sfCreds || !nsCreds) {
      return NextResponse.json({ error: 'One or both connections not found.' }, { status: 404 });
    }

    let analysisResult: PairResult | null = null;

    const { reply } = await runAgenticLoop(messages, SYSTEM_PROMPT, TOOLS, async (call) => {
      if (call.name === 'get_schemas') {
        return executeGetSchemas(sfCreds, nsCreds, sfObject, nsObject);
      }
      if (call.name === 'compute_match_analysis') {
        const args = call.args as { sf_field: string; ns_field: string };
        const raw = await executeComputeMatchAnalysis(sfCreds, nsCreds, sfObject, nsObject, args.sf_field, args.ns_field);
        analysisResult = {
          sfTotal: raw.sf_total,
          nsTotal: raw.ns_total,
          matchedCount: raw.matched_count,
          unmatchedSfCount: raw.unmatched_sf_count,
          unmatchedNsCount: raw.unmatched_ns_count,
          sfMatchFields: raw.sf_match_fields,
          nsMatchFields: raw.ns_match_fields,
          matchedPairs: raw.matched_pairs,
          unmatchedSfRecords: raw.unmatched_sf_records,
          unmatchedNsRecords: raw.unmatched_ns_records,
        };
        // Return only a summary to the model to keep context manageable
        return {
          sf_total: raw.sf_total,
          ns_total: raw.ns_total,
          matched_count: raw.matched_count,
          unmatched_sf_count: raw.unmatched_sf_count,
          unmatched_ns_count: raw.unmatched_ns_count,
          sf_match_fields: raw.sf_match_fields,
          ns_match_fields: raw.ns_match_fields,
          note: 'Full data returned to UI separately.',
        };
      }
      return { error: `Unknown tool: ${call.name}` };
    });

    return NextResponse.json({ reply, analysisResult });
  } catch (err) {
    console.error('Product syncer analyze error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
