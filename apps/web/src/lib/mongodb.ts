import { MongoClient, type Db } from 'mongodb';

const dbName = 'qtc_syncer';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  return new MongoClient(uri).connect();
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

// Lazy proxy — defers MongoClient creation until first await (runtime, not build time)
const clientPromise: Promise<MongoClient> = {
  then: (onfulfilled, onrejected) => getClientPromise().then(onfulfilled, onrejected),
  catch: (onrejected) => getClientPromise().catch(onrejected),
  finally: (onfinally) => getClientPromise().finally(onfinally),
  [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;

export default clientPromise;
