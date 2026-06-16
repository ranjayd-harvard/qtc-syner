import { z } from 'zod';

export const fieldMappingSchema = z.object({
  sourceFields: z.array(z.string().min(1)).min(1),
  targetFields: z.array(z.string().min(1)).min(1),
  condition: z.enum(['AND', 'OR']).optional(),
});

export const productSyncerMappingSchema = z.object({
  name: z.string().min(1),
  sfConnectionId: z.string().min(1),
  sfConnectionName: z.string().min(1),
  sfDataMode: z.enum(['object', 'soql']).default('object'),
  sfObject: z.string().default(''),
  sfQuery: z.string().optional(),
  nsConnectionId: z.string().min(1),
  nsConnectionName: z.string().min(1),
  nsDataMode: z.enum(['object', 'suiteql']).default('object'),
  nsObject: z.string().default(''),
  nsQuery: z.string().optional(),
  fieldMappings: z.array(fieldMappingSchema),
});
