import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import testRouter from './routes/test.js';
import objectsRouter from './routes/objects.js';
import dataRouter from './routes/data.js';
import schemaRouter from './routes/schema.js';
import queryRouter from './routes/query.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: false }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', authMiddleware);
app.use('/api/test', testRouter);
app.use('/api/objects', objectsRouter);
app.use('/api/data', dataRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/query', queryRouter);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`[connector-api] Listening on port ${PORT}`);
});

export default app;
