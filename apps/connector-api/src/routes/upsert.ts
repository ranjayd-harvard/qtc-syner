import { Router } from 'express';
import { z } from 'zod';
import { createConnector } from '../factory/connector.factory.js';

const router = Router();

const schema = z.object({
  type: z.enum(['salesforce', 'netsuite', 'redshift']),
  credentials: z.record(z.unknown()),
  objectName: z.string().min(1),
  records: z.array(z.record(z.unknown())).min(1).max(5000),
  options: z.object({
    mode: z.enum(['create', 'update', 'upsert']),
    externalIdField: z.string().optional(),
  }),
});

router.post('/', async (req, res, next) => {
  try {
    const { type, credentials, objectName, records, options } = schema.parse(req.body);
    const connector = createConnector(type, credentials as never);
    const result = await connector.upsertRecords(objectName, records, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
