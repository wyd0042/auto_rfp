/**
 * AI Suggestions API Endpoint
 * 
 * Generates AI-powered suggestions for sections and questions from RFP documents.
 * Used in AI-Assisted mode of the hybrid question selection feature.
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 5.1**
 * 
 * POST /api/ai-suggestions
 * 
 * Request Body:
 * - content: string - The text content of the document
 * - documentName: string - Name of the document
 * - projectId?: string - Optional project ID for context
 * 
 * Response:
 * - suggestions: Array of suggested annotations with id, text, type, confidence
 * - documentName: string
 * - generatedAt: string (ISO timestamp)
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { AISuggestionsRequestSchema } from '@/lib/validators/ai-suggestions';
import { aiSuggestionService, suggestionsToAnnotations } from '@/lib/services/ai-suggestion-service';
import { ValidationError } from '@/lib/errors/api-errors';

export async function POST(request: NextRequest) {
  return apiHandler(async () => {
    console.log('=== AI Suggestions API Called ===');

    // Parse and validate request body
    const body = await request.json();
    console.log('Request body keys:', Object.keys(body));
    console.log('Content length:', body.content?.length || 0);
    console.log('Document name:', body.documentName);

    const parseResult = AISuggestionsRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request data', parseResult.error.errors);
    }

    const { content, documentName } = parseResult.data;

    // Generate suggestions using AI service
    console.log('Starting AI suggestion generation...');
    const rawSuggestions = await aiSuggestionService.generateSuggestions(content, documentName);

    // Convert to annotation format with IDs
    const suggestions = suggestionsToAnnotations(rawSuggestions).map((annotation) => ({
      id: annotation.id,
      text: annotation.text,
      type: annotation.type,
      confidence: rawSuggestions.find((s) => s.text === annotation.text)?.confidence || 0.5,
      pageNumber: annotation.pageNumber,
    }));

    console.log(`Successfully generated ${suggestions.length} suggestions for ${documentName}`);

    return {
      suggestions,
      documentName,
      generatedAt: new Date().toISOString(),
    };
  });
}
