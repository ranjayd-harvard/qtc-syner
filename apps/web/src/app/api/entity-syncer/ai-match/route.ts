import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/ai-providers';
import type { JSONSchema } from '@/lib/ai-providers';

export const maxDuration = 120;

const PROMPT = `You are a data reconciliation specialist. You have two lists of records from Salesforce (SF) and NetSuite (NS) that could NOT be matched by exact field comparison. These records may represent the same real-world product, item, or entity stored with different values or in different fields.

Your task: Identify which SF records likely match which NS records based on:
- Similar names or descriptions (ignoring capitalisation, punctuation, whitespace)
- Codes or identifiers that appear under different field names across systems
- Semantic similarity (same product, different naming convention or abbreviation)
- Any strong pattern suggesting the same entity in both systems

Return ONLY matches where confidence >= 0.5. For each match provide:
- sf_index: 0-based index into the SF records array
- ns_index: 0-based index into the NS records array
- confidence: 0.0–1.0 (0.9+ very confident, 0.7–0.9 likely, 0.5–0.7 possible)
- reasons: 2–4 short, specific observations that justify the match

Do NOT suggest a match where there is no clear evidence. Fewer high-confidence suggestions are better than many speculative ones.`;

const MATCH_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sf_index: { type: 'integer', description: '0-based index into the Salesforce sample array' },
          ns_index: { type: 'integer', description: '0-based index into the NetSuite sample array' },
          confidence: { type: 'number', description: 'Confidence score from 0.0 to 1.0' },
          reasons: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific observations justifying this match',
          },
        },
        required: ['sf_index', 'ns_index', 'confidence', 'reasons'],
      },
    },
  },
  required: ['matches'],
};

function trimRecord(record: Record<string, unknown>, maxFields = 12): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .slice(0, maxFields)
  );
}

export async function POST(req: Request) {
  try {
    const {
      sfRecords,
      nsRecords,
      sfSampleSize = 50,
      nsSampleSize = 50,
    } = await req.json() as {
      sfRecords: Record<string, unknown>[];
      nsRecords: Record<string, unknown>[];
      sfSampleSize?: number;
      nsSampleSize?: number;
    };

    if (!sfRecords?.length || !nsRecords?.length) {
      return NextResponse.json({ matches: [], sfSampleSize: 0, nsSampleSize: 0 });
    }

    const sfSample = sfRecords.slice(0, sfSampleSize).map((r) => trimRecord(r));
    const nsSample = nsRecords.slice(0, nsSampleSize).map((r) => trimRecord(r));

    const userPrompt = `${PROMPT}

Salesforce records (${sfSample.length} unmatched records, indexed 0–${sfSample.length - 1}):
${JSON.stringify(sfSample, null, 2)}

NetSuite records (${nsSample.length} unmatched records, indexed 0–${nsSample.length - 1}):
${JSON.stringify(nsSample, null, 2)}

Find matches.`;

    const parsed = await generateJSON<{
      matches: Array<{ sf_index: number; ns_index: number; confidence: number; reasons: string[] }>;
    }>(userPrompt, MATCH_SCHEMA);

    const matches = (parsed.matches ?? [])
      .filter(
        (m) =>
          Number.isInteger(m.sf_index) &&
          Number.isInteger(m.ns_index) &&
          m.sf_index >= 0 &&
          m.sf_index < sfSample.length &&
          m.ns_index >= 0 &&
          m.ns_index < nsSample.length &&
          typeof m.confidence === 'number' &&
          m.confidence >= 0.5
      )
      .map((m) => ({
        sfRecord: sfRecords[m.sf_index],
        nsRecord: nsRecords[m.ns_index],
        confidence: Math.min(1, Math.max(0, m.confidence)),
        reasons: Array.isArray(m.reasons) ? m.reasons.filter((r) => typeof r === 'string') : [],
      }))
      .sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      matches,
      sfSampleSize: sfSample.length,
      nsSampleSize: nsSample.length,
    });
  } catch (err) {
    console.error('AI match error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
