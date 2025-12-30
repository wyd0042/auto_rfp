/**
 * AI Suggestion Service
 * 
 * Generates AI-powered suggestions for sections and questions from RFP documents.
 * Uses Gemini to analyze document content and identify potential annotations.
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 5.1**
 */

// Setup proxy before any network requests
import '../proxy-setup';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIServiceConfig } from '@/lib/interfaces/ai-service';
import { DEFAULT_LANGUAGE_MODEL } from '@/lib/constants';
import { AIServiceError } from '@/lib/errors/api-errors';
import type { SuggestedAnnotation, AnnotationType } from '@/types/annotation';
import { v4 as uuidv4 } from 'uuid';

/**
 * Response format from Gemini for suggestions
 */
interface GeminiSuggestionResponse {
  suggestions: {
    text: string;
    type: 'section' | 'question';
    confidence: number;
    pageNumber?: number;
  }[];
}

/**
 * Chunk size for processing large documents
 */
const CHUNK_SIZE = 15000;

/**
 * AI Suggestion Service class
 * 
 * Analyzes RFP documents and generates suggestions for sections and questions
 * that users can accept or reject in AI-Assisted mode.
 */
export class AISuggestionService {
  private client: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  private config: AIServiceConfig;

  constructor(config: Partial<AIServiceConfig> = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIServiceError('Gemini API key is not configured');
    }

    this.client = new GoogleGenerativeAI(apiKey);

    this.config = {
      model: DEFAULT_LANGUAGE_MODEL,
      temperature: 0.2,
      maxTokens: 4096,
      timeout: 120000,
      ...config,
    };

    this.model = this.client.getGenerativeModel({
      model: this.config.model,
    });
  }


  /**
   * Generate suggestions for sections and questions from document content.
   * 
   * Analyzes the document and returns suggested annotations with confidence scores.
   * Handles errors gracefully and returns empty array on failure.
   * 
   * @param content - The text content of the document
   * @param documentName - Name of the document for context
   * @returns Array of suggested annotations with text, type, and confidence
   * 
   * **Requirements: 5.1**
   */
  async generateSuggestions(
    content: string,
    documentName: string
  ): Promise<SuggestedAnnotation[]> {
    try {
      console.log(`[AISuggestionService] Generating suggestions for: ${documentName}`);
      console.log(`[AISuggestionService] Content length: ${content.length} chars`);

      // Truncate content if too large
      const truncatedContent = content.length > CHUNK_SIZE 
        ? content.substring(0, CHUNK_SIZE) 
        : content;

      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.formatUserPrompt(truncatedContent, documentName);

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          responseMimeType: 'application/json',
        },
      });

      const assistantMessage = result.response.text();
      if (!assistantMessage) {
        console.warn('[AISuggestionService] Empty response from Gemini');
        return [];
      }

      const rawData = this.extractJsonFromResponse(assistantMessage);
      return this.validateAndTransformSuggestions(rawData);
    } catch (error) {
      console.error('[AISuggestionService] Error generating suggestions:', error);
      
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      throw new AIServiceError(
        `Failed to generate suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the system prompt for suggestion generation
   */
  private getSystemPrompt(): string {
    return `
You are an expert at analyzing RFP (Request for Proposal) documents. Your task is to identify:
1. Section headers - titles that organize the document into logical parts
2. Questions - specific questions that vendors need to answer

Return a JSON object with suggestions in this exact format:
{
  "suggestions": [
    {
      "text": "The exact text from the document",
      "type": "section" or "question",
      "confidence": 0.0 to 1.0
    }
  ]
}

Rules:
- Extract the EXACT text as it appears in the document
- Sections are typically headers, titles, or category names (e.g., "Technical Requirements", "Pricing Information")
- Questions are specific items that require a response (often end with "?" or are numbered requirements)
- Assign confidence based on how certain you are:
  - 0.9-1.0: Very clear section header or explicit question
  - 0.7-0.9: Likely a section or question based on context
  - 0.5-0.7: Possible section or question, less certain
- Maximum 15 suggestions total
- Maximum 5 sections
- Maximum 10 questions
- Only include suggestions with confidence >= 0.5
- Return valid JSON only
    `.trim();
  }

  /**
   * Format the user prompt with document content
   */
  private formatUserPrompt(content: string, documentName: string): string {
    return `Document Name: ${documentName}\n\nDocument Content:\n${content}`;
  }


  /**
   * Extract JSON from response, handling markdown code blocks and various formats
   */
  private extractJsonFromResponse(content: string): GeminiSuggestionResponse {
    if (!content) {
      throw new AIServiceError('No content to parse');
    }

    const trimmed = content.trim();

    const strategies = [
      // Try extracting from markdown code block
      () => {
        const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) return JSON.parse(match[1].trim());
        return null;
      },
      // Try extracting JSON object directly
      () => {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return null;
      },
      // Try parsing as-is
      () => JSON.parse(trimmed),
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result !== null) return result as GeminiSuggestionResponse;
      } catch {
        // Try next strategy
      }
    }

    console.error('[AISuggestionService] Failed to parse JSON:', trimmed.substring(0, 500));
    throw new AIServiceError('Could not extract valid JSON from AI response');
  }

  /**
   * Validate and transform raw suggestions from Gemini response
   */
  private validateAndTransformSuggestions(
    rawData: GeminiSuggestionResponse
  ): SuggestedAnnotation[] {
    if (!rawData.suggestions || !Array.isArray(rawData.suggestions)) {
      console.warn('[AISuggestionService] Invalid suggestions format, returning empty array');
      return [];
    }

    const validSuggestions: SuggestedAnnotation[] = [];

    for (const suggestion of rawData.suggestions) {
      // Validate required fields
      if (!suggestion.text || typeof suggestion.text !== 'string') {
        continue;
      }

      if (!suggestion.type || !['section', 'question'].includes(suggestion.type)) {
        continue;
      }

      // Validate confidence
      const confidence = typeof suggestion.confidence === 'number' 
        ? Math.max(0, Math.min(1, suggestion.confidence))
        : 0.5;

      // Skip low confidence suggestions
      if (confidence < 0.5) {
        continue;
      }

      validSuggestions.push({
        text: suggestion.text.trim(),
        type: suggestion.type as AnnotationType,
        confidence,
        pageNumber: suggestion.pageNumber,
      });
    }

    // Sort by confidence (highest first)
    validSuggestions.sort((a, b) => b.confidence - a.confidence);

    console.log(`[AISuggestionService] Generated ${validSuggestions.length} valid suggestions`);
    return validSuggestions;
  }
}

// Export singleton instance
export const aiSuggestionService = new AISuggestionService();

/**
 * Convert SuggestedAnnotation to Annotation format for use in the UI
 * Generates unique IDs and adds required fields
 */
export function suggestionsToAnnotations(
  suggestions: SuggestedAnnotation[]
): import('@/types/annotation').Annotation[] {
  return suggestions.map((suggestion) => ({
    id: uuidv4(),
    type: suggestion.type,
    text: suggestion.text,
    pageNumber: suggestion.pageNumber || 1,
    createdAt: new Date(),
    source: 'ai-suggestion' as const,
  }));
}
