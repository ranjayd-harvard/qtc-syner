import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { Part, FunctionDeclaration } from '@google/generative-ai';
import { getDecryptedCredentials } from '@/models/Connection';
import { connectorClient } from '@/lib/connector-client';
import { computeMatchAnalysis } from '@/lib/product-syncer-compute';
import type { PairResult } from '@/lib/product-syncer-compute';
import type { ConnectionType, RawCredentials } from '@/types/connection';

export type { PairResult as AnalysisResult } from '@/lib/product-syncer-compute';

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

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_schemas',
    description: 'Fetch field metadata for Salesforce Product2 and NetSuite item to identify candidate matching columns.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'compute_match_analysis',
    description: 'Fetch all records from both systems and compute exact-value matches on a chosen field pair. Returns totals, match counts, matched pairs, and unmatched Salesforce records.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sf_field: {
          type: SchemaType.STRING,
          description: 'Salesforce Product2 field name to match on (API name, e.g. "ProductCode")',
        },
        ns_field: {
          type: SchemaType.STRING,
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
    salesforce_product2_fields: sfSchema.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
    })),
    netsuite_item_fields: nsSchema.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
    })),
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
    sf_match_field: raw.sfMatchField,
    ns_match_field: raw.nsMatchField,
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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Add it to your .env file.' },
        { status: 500 }
      );
    }

    const [sfCreds, nsCreds] = await Promise.all([
      getDecryptedCredentials(sfConnectionId),
      getDecryptedCredentials(nsConnectionId),
    ]);

    if (!sfCreds || !nsCreds) {
      return NextResponse.json({ error: 'One or both connections not found.' }, { status: 404 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    });

    // Build chat history from prior messages (all but the last)
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];

    let result = await chat.sendMessage(lastMessage.content);

    // Agentic tool-call loop
    let analysisResult: PairResult | null = null;

    while (true) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;

      const toolResponses = await Promise.all(
        calls.map(async (call) => {
          let response: unknown;
          if (call.name === 'get_schemas') {
            response = await executeGetSchemas(sfCreds, nsCreds, sfObject, nsObject);
          } else if (call.name === 'compute_match_analysis') {
            const args = call.args as { sf_field: string; ns_field: string };
            const raw = await executeComputeMatchAnalysis(sfCreds, nsCreds, sfObject, nsObject, args.sf_field, args.ns_field);
            analysisResult = {
              sfTotal: raw.sf_total,
              nsTotal: raw.ns_total,
              matchedCount: raw.matched_count,
              unmatchedSfCount: raw.unmatched_sf_count,
              unmatchedNsCount: raw.unmatched_ns_count,
              sfMatchField: raw.sf_match_field,
              nsMatchField: raw.ns_match_field,
              matchedPairs: raw.matched_pairs,
              unmatchedSfRecords: raw.unmatched_sf_records,
              unmatchedNsRecords: raw.unmatched_ns_records,
            };
            // Return a summary to the model (not the full data) to keep context manageable
            response = {
              sf_total: raw.sf_total,
              ns_total: raw.ns_total,
              matched_count: raw.matched_count,
              unmatched_sf_count: raw.unmatched_sf_count,
              unmatched_ns_count: raw.unmatched_ns_count,
              sf_match_field: raw.sf_match_field,
              ns_match_field: raw.ns_match_field,
              note: `Full data returned to UI separately.`,
            };
          } else {
            response = { error: `Unknown tool: ${call.name}` };
          }
          return { functionResponse: { name: call.name, response: response as object } } as Part;
        })
      );

      result = await chat.sendMessage(toolResponses as Part[]);
    }

    return NextResponse.json({
      reply: result.response.text(),
      analysisResult,
    });
  } catch (err) {
    console.error('Product syncer analyze error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
