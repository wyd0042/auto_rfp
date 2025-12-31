/*
 * This functionality has been temporarily removed to focus on document upload.
 * We'll implement it in a future update when adding the dashboard.
 */

// CRITICAL: Initialize LlamaCloud client FIRST before any other imports
import '@/lib/llamacloud-init';

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/middleware/api-handler';
import { ResponseGenerationService } from '@/lib/services/response-generation-service';
import { 
  generateResponseSchema, 
  GenerateResponseRequest 
} from '@/lib/validators/generate-response';

const responseGenerationService = new ResponseGenerationService();

async function handleGenerateResponse(
  request: NextRequest,
  validatedData: GenerateResponseRequest
): Promise<NextResponse> {
  const result = await responseGenerationService.generateResponse(validatedData);
  return NextResponse.json(result);
}

export const POST = withApiHandler(handleGenerateResponse, {
  validationSchema: generateResponseSchema,
});
