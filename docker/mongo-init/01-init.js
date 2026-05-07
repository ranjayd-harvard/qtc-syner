// MongoDB initialization script — runs only on first container start
db = db.getSiblingDB('qtc_syncer');

// Collections
db.createCollection('connections');
db.createCollection('activity_logs');
db.createCollection('users');

// Indexes — connections
db.connections.createIndex({ type: 1 });
db.connections.createIndex({ status: 1 });
db.connections.createIndex({ createdAt: -1 });

// Indexes — activity_logs
db.activity_logs.createIndex({ connectionId: 1, createdAt: -1 });
db.activity_logs.createIndex({ createdAt: -1 });
// TTL: auto-delete logs older than 30 days
db.activity_logs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }
);

// Indexes — users
db.users.createIndex({ email: 1 }, { unique: true });

print('[qtc-syncer] MongoDB initialized: collections and indexes created.');
