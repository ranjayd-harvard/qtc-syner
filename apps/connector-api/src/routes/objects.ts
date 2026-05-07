import { Router } from 'express';
import { z } from 'zod';
import { createConnector } from '../factory/connector.factory.js';

const router = Router();

const schema = z.object({
  type: z.enum(['salesforce', 'netsuite', 'redshift']),
  credentials: z.record(z.unknown()),
});

router.post('/', async (req, res, next) => {
  try {
    const { type, credentials } = schema.parse(req.body);
    const connector = createConnector(type, credentials as never);
    const objects = await connector.listObjects();
    res.json({ objects });
  } catch (err) {
    next(err);
  }
});

export default router;
