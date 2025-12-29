import { IQuestionExtractionService } from '@/lib/interfaces/ai-service';
import { ExtractQuestionsRequest, ExtractedQuestions, ExtractQuestionsResponse } from '@/lib/validators/extract-questions';
import { geminiQuestionExtractor } from './gemini-question-extractor';
import { projectService } from '@/lib/project-service';
import { DatabaseError, AIServiceError } from '@/lib/errors/api-errors';

/**
 * Main service for question extraction operations
 */
export class QuestionExtractionService implements IQuestionExtractionService {
  /**
   * Process document and extract questions
   */
  async processDocument(request: ExtractQuestionsRequest): Promise<ExtractQuestionsResponse> {
    try {
      // Stage 1: Extract questions, generate summary, and extract eligibility using AI (parallel execution)
      const [extractedQuestions, summary, eligibility] = await Promise.all([
        this.extractQuestions(request.content, request.documentName),
        this.generateSummary(request.content, request.documentName),
        this.extractEligibility(request.content, request.documentName)
      ]);
      
      // Stage 2: Save to database (questions, summary, and eligibility)
      await Promise.all([
        this.saveQuestions(request.projectId, extractedQuestions.sections),
        this.saveSummary(request.projectId, summary),
        this.saveEligibility(request.projectId, eligibility)
      ]);
      
      // Stage 3: Return structured response
      const response: ExtractQuestionsResponse = {
        documentId: request.projectId,
        documentName: request.documentName,
        sections: extractedQuestions.sections,
        extractedAt: new Date().toISOString(),
        summary, // Include summary in response
        eligibility, // Include eligibility in response
      };
      
      return response;
    } catch (error) {
      if (error instanceof AIServiceError || error instanceof DatabaseError) {
        throw error;
      }
      throw new AIServiceError(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract questions from content using AI
   */
  private async extractQuestions(content: string, documentName: string): Promise<ExtractedQuestions> {
    try {
      return await geminiQuestionExtractor.extractQuestions(content, documentName);
    } catch (error) {
      throw new AIServiceError(`AI question extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate summary from content using AI
   */
  private async generateSummary(content: string, documentName: string): Promise<string> {
    try {
      return await geminiQuestionExtractor.generateSummary(content, documentName);
    } catch (error) {
      throw new AIServiceError(`AI summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract eligibility requirements from content using AI
   */
  private async extractEligibility(content: string, documentName: string): Promise<string[]> {
    try {
      return await geminiQuestionExtractor.extractEligibility(content, documentName);
    } catch (error) {
      throw new AIServiceError(`AI eligibility extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save extracted questions to storage
   */
  async saveQuestions(projectId: string, sections: any[]): Promise<void> {
    try {
      await projectService.saveQuestions(projectId, sections);
    } catch (error) {
      throw new DatabaseError(`Failed to save questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save generated summary to storage
   */
  async saveSummary(projectId: string, summary: string): Promise<void> {
    try {
      await projectService.saveSummary(projectId, summary);
    } catch (error) {
      throw new DatabaseError(`Failed to save summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save extracted eligibility requirements to storage
   */
  async saveEligibility(projectId: string, eligibility: string[]): Promise<void> {
    try {
      await projectService.saveEligibility(projectId, eligibility);
    } catch (error) {
      throw new DatabaseError(`Failed to save eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get extraction statistics
   */
  getExtractionStats(extractedQuestions: ExtractedQuestions): { sectionCount: number; questionCount: number } {
    const sectionCount = extractedQuestions.sections?.length || 0;
    const questionCount = extractedQuestions.sections?.reduce((total, section) => {
      return total + (section.questions?.length || 0);
    }, 0) || 0;

    return { sectionCount, questionCount };
  }
}

// Export singleton instance
export const questionExtractionService = new QuestionExtractionService(); 