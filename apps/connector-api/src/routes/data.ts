import { Router } from 'express';
import { z } from 'zod';
import { createConnector } from '../factory/connector.factory.js';

const router = Router();

const schema = z.object({
  type: z.enum(['salesforce', 'netsuite', 'redshift']),
  credentials: z.record(z.unknown()),
  options: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(500).default(25),
    sort: z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    }).optional(),
    filter: z.string().optional(),
  }),
});

router.post('/:objectName', async (req, res, next) => {
  try {
    const { type, credentials, options } = schema.parse(req.body);
    const connector = createConnector(type, credentials as never);
    const result = await connector.fetchData(req.params.objectName, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
