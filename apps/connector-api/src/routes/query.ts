import { Router } from 'express';
import { z } from 'zod';
import { createConnector } from '../factory/connector.factory.js';

const router = Router();

const schema = z.object({
  type: z.enum(['salesforce', 'netsuite', 'redshift']),
  credentials: z.record(z.unknown()),
  query: z.string().min(1),
  options: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(500).default(25),
    cursor: z.string().optional(),
  }).default({}),
});

// Parse column names from a SELECT statement when the query returns 0 rows.
// Handles aliases (AS), table-qualified names (t.field), and function calls.
// Returns [] for SELECT * (indeterminate) or non-SELECT statements.
function parseSelectColumns(query: string): string[] {
  const normalized = query.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^SELECT\s+(.*?)\s+FROM\b/i);
  if (!match) return [];
  const colsPart = match[1].trim();
  if (colsPart === '*') return [];

  // Split by commas while respecting nested parentheses (e.g. COUNT(*), CASE WHEN)
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of colsPart) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map((part) => {
    // "expr AS alias" → alias
    const asMatch = part.match(/\bAS\s+(\w+)\s*$/i);
    if (asMatch) return asMatch[1];
    // "table.field" → field (last segment after last dot)
    const lastToken = part.split('.').pop()!.trim();
    // "func(...)" → func name
    const fnMatch = lastToken.match(/^(\w+)\s*\(/);
    if (fnMatch) return fnMatch[1];
    return lastToken;
  }).filter(Boolean);
}

router.post('/', async (req, res, next) => {
  try {
    const { type, credentials, query, options } = schema.parse(req.body);
    const connector = createConnector(type, credentials as never);
    const result = await connector.executeQuery(query, options);
    // When the query returns 0 rows the connector has no row to inspect for column names.
    // Fall back to parsing the SELECT clause so the UI can still show a column picker.
    if (result.columns.length === 0) {
      result.columns = parseSelectColumns(query);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
