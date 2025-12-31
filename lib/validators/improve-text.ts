/**
 * Validators for Improve Text API
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 1.1, 2.1, 3.1, 4.1, 7.2**
 */

import { z } from 'zod';

/**
 * Valid improvement action types
 */
export const ImprovementActionSchema = z.enum([
  'proofread',
  'make_professional',
  'make_concise',
  'convert_to_bullets',
]);

/**
 * Request schema for text improvement
 * - text: required, min 10 chars, max 10000 chars
 * - action: required, must be a valid improvement action
 */
export const ImproveTextRequestSchema = z.object({
  text: z
    .string()
    .min(10, 'Text must be at least 10 characters')
    .max(10000, 'Text must not exceed 10000 characters'),
  action: ImprovementActionSchema,
});

/**
 * Response schema for text improvement
 */
export const ImproveTextResponseSchema = z.object({
  improvedText: z.string(),
  action: z.string(),
  originalLength: z.number(),
  improvedLength: z.number(),
});

// Type exports
export type ImprovementAction = z.infer<typeof ImprovementActionSchema>;
export type ImproveTextRequest = z.infer<typeof ImproveTextRequestSchema>;
export type ImproveTextResponse = z.infer<typeof ImproveTextResponseSchema>;
