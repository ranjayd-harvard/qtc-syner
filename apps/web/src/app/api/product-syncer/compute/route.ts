import { getDecryptedCredentials } from '@/models/Connection';
import { fetchAllRecords, fetchAllRecordsByQuery, computeMatchesFromRows } from '@/lib/product-syncer-compute';

export const maxDuration = 300;

export async function POST(req: Request) {
  const {
    sfConnectionId, sfDataMode = 'object', sfObject, sfQuery,
    nsConnectionId, nsDataMode = 'object', nsObject, nsQuery,
    sfField, nsField, sfFilter, nsFilter, sfLimit, nsLimit,
  } = await req.json() as {
    sfConnectionId: string;
    sfDataMode?: 'object' | 'soql';
    sfObject?: string;
    sfQuery?: string;
    nsConnectionId: string;
    nsDataMode?: 'object' | 'suiteql';
    nsObject?: string;
    nsQuery?: string;
    sfField: string;
    nsField: string;
    sfFilter?: string;
    nsFilter?: string;
    sfLimit?: number;
    nsLimit?: number;
  };

  const sfSourceValid = sfDataMode === 'soql' ? !!sfQuery : !!sfObject;
  const nsSourceValid = nsDataMode === 'suiteql' ? !!nsQuery : !!nsObject;

  if (!sfConnectionId || !nsConnectionId || !sfField || !nsField || !sfSourceValid || !nsSourceValid) {
    return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400 });
  }

  const [sfCreds, nsCreds] = await Promise.all([
    getDecryptedCredentials(sfConnectionId),
    getDecryptedCredentials(nsConnectionId),
  ]);

  if (!sfCreds || !nsCreds) {
    return new Response(JSON.stringify({ error: 'One or both connections not found.' }), { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const [sfRows, nsRows] = await Promise.all([
          sfDataMode === 'soql'
            ? fetchAllRecordsByQuery(sfCreds, sfQuery!, {
                limit: sfLimit,
                onPage: (page, count) => send({ type: 'progress', phase: 'sf', page, count }),
              })
            : fetchAllRecords(sfCreds, sfObject!, {
                filter: sfFilter,
                limit: sfLimit,
                onPage: (page, count) => send({ type: 'progress', phase: 'sf', page, count }),
              }),
          nsDataMode === 'suiteql'
            ? fetchAllRecordsByQuery(nsCreds, nsQuery!, {
                limit: nsLimit,
                onPage: (page, count) => send({ type: 'progress', phase: 'ns', page, count }),
              })
            : fetchAllRecords(nsCreds, nsObject!, {
                filter: nsFilter,
                limit: nsLimit,
                onPage: (page, count) => send({ type: 'progress', phase: 'ns', page, count }),
              }),
        ]);

        send({ type: 'computing' });
        const result = computeMatchesFromRows(sfRows, nsRows, sfField, nsField);
        send({ type: 'result', data: result });
      } catch (err) {
        console.error('Product syncer compute error:', err);
        send({ type: 'error', error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
