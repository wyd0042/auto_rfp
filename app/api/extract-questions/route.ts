import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { ExtractQuestionsRequestSchema } from '@/lib/validators/extract-questions';
import { questionExtractionService } from '@/lib/services/question-extraction-service';
import { ValidationError } from '@/lib/errors/api-errors';

export async function POST(request: NextRequest) {
  return apiHandler(async () => {
    // Parse and validate request body
    console.log("=== Extract Questions API Called ===");
    
    const body = await request.json();
    console.log("Request body keys:", Object.keys(body));
    console.log("Content length:", body.content?.length || 0);
    console.log("Project ID:", body.projectId);
    console.log("Document name:", body.documentName);
    
    const validatedRequest = ExtractQuestionsRequestSchema.parse(body);
    
    // Process document using service layer
    console.log("Starting question extraction...");
    const result = await questionExtractionService.processDocument(validatedRequest);

    // Log success metrics
    const stats = questionExtractionService.getExtractionStats(result);
    console.log(`Successfully extracted ${stats.sectionCount} sections and ${stats.questionCount} questions for project ${validatedRequest.projectId}`);
    
    return result;
  });
} 