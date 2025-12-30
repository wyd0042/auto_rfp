/**
 * Validators for AI Suggestions API
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 5.1**
 */

import { z } from 'zod';

/**
 * Request schema for generating AI suggestions
 */
export const AISuggestionsRequestSchema = z.object({
  content: z.string().min(1, 'Document content is required'),
  documentName: z.string().min(1, 'Document name is required'),
  projectId: z.string().optional(),
});

/**
 * Schema for a single suggestion
 */
export const SuggestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['section', 'question']),
  confidence: z.number().min(0).max(1),
  pageNumber: z.number().optional(),
});

/**
 * Response schema for AI suggestions
 */
export const AISuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
  documentName: z.string(),
  generatedAt: z.string(),
});

// Type exports
export type AISuggestionsRequest = z.infer<typeof AISuggestionsRequestSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type AISuggestionsResponse = z.infer<typeof AISuggestionsResponseSchema>;
