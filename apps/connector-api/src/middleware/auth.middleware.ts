import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-internal-api-key'];
  if (!key || key !== process.env.CONNECTOR_INTERNAL_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
