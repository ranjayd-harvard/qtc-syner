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
  }).default({}),
});

router.post('/', async (req, res, next) => {
  try {
    const { type, credentials, query, options } = schema.parse(req.body);
    const connector = createConnector(type, credentials as never);
    const result = await connector.executeQuery(query, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
