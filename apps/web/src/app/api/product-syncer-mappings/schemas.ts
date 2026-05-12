import { z } from 'zod';

export const fieldMappingSchema = z.object({
  sourceField: z.string().min(1),
  targetField: z.string().min(1),
});

export const productSyncerMappingSchema = z.object({
  name: z.string().min(1),
  sfConnectionId: z.string().min(1),
  sfConnectionName: z.string().min(1),
  nsConnectionId: z.string().min(1),
  nsConnectionName: z.string().min(1),
  fieldMappings: z.array(fieldMappingSchema),
});
