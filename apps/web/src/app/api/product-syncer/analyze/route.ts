import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { Part, FunctionDeclaration } from '@google/generative-ai';
import { getDecryptedCredentials } from '@/models/Connection';
import { connectorClient } from '@/lib/connector-client';
import type { ConnectionType, RawCredentials } from '@/types/connection';

export const maxDuration = 120;

const SF_OBJECT = 'Product2';
const NS_OBJECT = 'item';
const MAX_RECORDS = 2000;
const PAGE_SIZE = 500;

const SYSTEM_PROMPT = `You are a data sync analyst for the QTC Syncer platform. Your job is to analyze how well Salesforce Product2 records match NetSuite item records.

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

async function fetchAllRecords(creds: Creds, objectName: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const maxPages = Math.ceil(MAX_RECORDS / PAGE_SIZE);

  for (let page = 1; page <= maxPages; page++) {
    const result = await connectorClient.data(
      creds.type as ConnectionType,
      creds.credentials,
      objectName,
      { page, pageSize: PAGE_SIZE }
    );
    rows.push(...(result.rows as Record<string, unknown>[]));
    if (result.rows.length < PAGE_SIZE || rows.length >= result.total) break;
  }

  return rows;
}

async function executeGetSchemas(sf: Creds, ns: Creds, nsObject: string) {
  const [sfSchema, nsSchema] = await Promise.all([
    connectorClient.schema(sf.type as ConnectionType, sf.credentials, SF_OBJECT),
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

async function executeComputeMatchAnalysis(sf: Creds, ns: Creds, nsObject: string, sfField: string, nsField: string) {
  const [sfRows, nsRows] = await Promise.all([
    fetchAllRecords(sf, SF_OBJECT),
    fetchAllRecords(ns, nsObject),
  ]);

  // Build lookup map keyed by nsField value
  const nsMap = new Map<string, Record<string, unknown>>();
  for (const row of nsRows) {
    const key = String(row[nsField] ?? '').trim();
    if (key) nsMap.set(key, row);
  }

  const matchedPairs: Array<{ sfRecord: Record<string, unknown>; nsRecord: Record<string, unknown> }> = [];
  const unmatchedSfRecords: Record<string, unknown>[] = [];

  for (const sfRow of sfRows) {
    const key = String(sfRow[sfField] ?? '').trim();
    if (key && nsMap.has(key)) {
      matchedPairs.push({ sfRecord: sfRow, nsRecord: nsMap.get(key)! });
    } else {
      unmatchedSfRecords.push(sfRow);
    }
  }

  return {
    sf_total: sfRows.length,
    ns_total: nsRows.length,
    matched_count: matchedPairs.length,
    unmatched_count: unmatchedSfRecords.length,
    sf_match_field: sfField,
    ns_match_field: nsField,
    // Cap arrays to keep response size reasonable
    matched_pairs: matchedPairs.slice(0, 200),
    unmatched_sf_records: unmatchedSfRecords.slice(0, 200),
  };
}

export interface AnalysisResult {
  sfTotal: number;
  nsTotal: number;
  matchedCount: number;
  unmatchedCount: number;
  sfMatchField: string;
  nsMatchField: string;
  matchedPairs: Array<{ sfRecord: Record<string, unknown>; nsRecord: Record<string, unknown> }>;
  unmatchedSfRecords: Record<string, unknown>[];
}

export async function POST(req: Request) {
  try {
    const { messages, sfConnectionId, nsConnectionId, nsObject } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      sfConnectionId: string;
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
    let analysisResult: AnalysisResult | null = null;

    while (true) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;

      const toolResponses = await Promise.all(
        calls.map(async (call) => {
          let response: unknown;
          if (call.name === 'get_schemas') {
            response = await executeGetSchemas(sfCreds, nsCreds, nsObject);
          } else if (call.name === 'compute_match_analysis') {
            const args = call.args as { sf_field: string; ns_field: string };
            const raw = await executeComputeMatchAnalysis(sfCreds, nsCreds, nsObject, args.sf_field, args.ns_field);
            analysisResult = {
              sfTotal: raw.sf_total,
              nsTotal: raw.ns_total,
              matchedCount: raw.matched_count,
              unmatchedCount: raw.unmatched_count,
              sfMatchField: raw.sf_match_field,
              nsMatchField: raw.ns_match_field,
              matchedPairs: raw.matched_pairs,
              unmatchedSfRecords: raw.unmatched_sf_records,
            };
            // Return a summary to the model (not the full data) to keep context manageable
            response = {
              sf_total: raw.sf_total,
              ns_total: raw.ns_total,
              matched_count: raw.matched_count,
              unmatched_count: raw.unmatched_count,
              sf_match_field: raw.sf_match_field,
              ns_match_field: raw.ns_match_field,
              note: `Full data (${raw.matched_pairs.length} matched pairs, ${raw.unmatched_sf_records.length} unmatched records) has been returned to the UI separately.`,
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
