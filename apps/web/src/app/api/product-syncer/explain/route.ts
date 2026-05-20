import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { sfField, nsField, nsObject, matchedCount, unmatchedCount, unmatchedSfSample, nsSample } =
      await req.json() as {
        sfField: string;
        nsField: string;
        nsObject: string;
        matchedCount: number;
        unmatchedCount: number;
        unmatchedSfSample: Record<string, unknown>[];
        nsSample: Record<string, unknown>[];
      };

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const sfValues = unmatchedSfSample
      .slice(0, 20)
      .map((r) => r[sfField])
      .filter((v) => v != null)
      .map(String);

    const nsValues = nsSample
      .slice(0, 20)
      .map((r) => r[nsField])
      .filter((v) => v != null)
      .map(String);

    const prompt = `You are a data quality analyst for a QTC system. Analyze why Salesforce Product2 records don't match NetSuite ${nsObject} records.

Match field pair: Salesforce "${sfField}" ↔ NetSuite "${nsField}"

Results: ${matchedCount} matched, ${unmatchedCount} unmatched in Salesforce

Sample of unmatched Salesforce "${sfField}" values — these exist in SF but not in NS (${sfValues.length} shown):
${sfValues.map((v) => `  - ${v}`).join('\n') || '  (none with non-null values)'}

Sample of unmatched NetSuite "${nsField}" values — these exist in NS but not in SF (${nsValues.length} shown):
${nsValues.map((v) => `  - ${v}`).join('\n') || '  (none with non-null values)'}

Please provide:
1. **Root cause analysis** — why are records not matching? Look for patterns like format differences, case sensitivity, prefixes/suffixes, special characters, truncation, or missing values. Compare the SF-only and NS-only values to spot patterns.
2. **Specific examples** of the mismatch pattern if visible in the sample data.
3. **Actionable guidance** — concrete steps to improve the match rate (e.g., data cleansing rules, field population requirements, sync configuration changes).

Be specific and concise. Format your response with clear headings.`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });

    const result = await model.generateContent(prompt);
    return NextResponse.json({ explanation: result.response.text() });
  } catch (err) {
    console.error('Product syncer explain error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
