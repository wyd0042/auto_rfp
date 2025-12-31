/**
 * Improve Text API Endpoint
 *
 * Provides AI-powered text improvement for RFP responses.
 * Supports four actions: proofread, make_professional, make_concise, convert_to_bullets.
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 1.1, 1.4, 2.1, 2.4, 3.1, 3.4, 4.1, 4.4, 7.2**
 *
 * POST /api/improve-text
 *
 * Request Body:
 * - text: string (min 10, max 10000 characters) - The text to improve
 * - action: ImprovementAction - The improvement action to apply
 *
 * Response:
 * - improvedText: string - The improved text
 * - action: string - The action that was applied
 * - originalLength: number - Length of original text
 * - improvedLength: number - Length of improved text
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { ImproveTextRequestSchema } from '@/lib/validators/improve-text';
import { getTextImprovementService } from '@/lib/services/text-improvement-service';
import { ValidationError, AIServiceError } from '@/lib/errors/api-errors';

export async function POST(request: NextRequest) {
  return apiHandler(async () => {
    // Parse request body
    const body = await request.json();

    // Validate request body
    const parseResult = ImproveTextRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request data', parseResult.error.errors);
    }

    const { text, action } = parseResult.data;

    try {
      // Get service instance and improve text
      const service = getTextImprovementService();
      const result = await service.improve(text, action);

      return {
        improvedText: result.improvedText,
        action: result.action,
        originalLength: result.originalLength,
        improvedLength: result.improvedLength,
      };
    } catch (error) {
      // Re-throw AIServiceError with appropriate message
      if (error instanceof AIServiceError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new AIServiceError(
        `Text improvement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });
}
