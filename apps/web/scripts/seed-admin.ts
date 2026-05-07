/**
 * Creates or updates the admin user in MongoDB.
 * Run: npm run seed
 * Requires MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD in .env.local
 */

import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

async function seed() {
  const uri = process.env.MONGODB_URI;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!uri || !email || !password) {
    console.error('Missing env: MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD');
    process.exit(1);
  }

  const client = await MongoClient.connect(uri);
  const db = client.db('qtc_syncer');

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const result = await db.collection('users').updateOne(
    { email },
    {
      $set: { email, passwordHash, name: 'Admin', updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  const action = result.upsertedCount > 0 ? 'Created' : 'Updated';
  console.log(`[seed] ${action} admin user: ${email}`);

  await client.close();
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
