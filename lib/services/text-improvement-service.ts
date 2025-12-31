/**
 * Text Improvement Service
 *
 * Provides AI-powered text improvement capabilities for RFP responses.
 * Supports four improvement actions: proofread, make_professional, make_concise, convert_to_bullets.
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 1.1, 2.1, 3.1, 4.1, 7.1, 7.3**
 */

// Setup proxy before any network requests
import '../proxy-setup';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIServiceConfig } from '@/lib/interfaces/ai-service';
import { DEFAULT_LANGUAGE_MODEL } from '@/lib/constants';
import { AIServiceError } from '@/lib/errors/api-errors';

// Re-export types and constants from shared file
export type { ImprovementAction, TextImprovementResult } from './text-improvement-types';
export { IMPROVEMENT_ACTIONS } from './text-improvement-types';

import type { ImprovementAction, TextImprovementResult } from './text-improvement-types';

/**
 * Action-specific prompts for text improvement
 * Each action has a distinct prompt template to guide the AI
 *
 * **Requirements: 7.3**
 */
export const ACTION_PROMPTS: Record<ImprovementAction, string> = {
  proofread: `You are a professional proofreader. Your task is to fix grammar, spelling, punctuation, and clarity issues in the following text.

Rules:
- Fix all grammatical errors
- Correct spelling mistakes
- Improve punctuation
- Enhance clarity where needed
- Preserve the original meaning and tone
- Do not add new information
- Return ONLY the corrected text, no explanations

Text to proofread:`,

  make_professional: `You are a business writing expert. Your task is to transform the following text into formal, professional business language suitable for RFP submissions.

Rules:
- Use formal business vocabulary
- Maintain a professional tone throughout
- Keep all key information intact
- Remove casual language and colloquialisms
- Use active voice where appropriate
- Ensure the text is suitable for corporate communications
- Return ONLY the professional version, no explanations

Text to make professional:`,

  make_concise: `You are an expert editor specializing in concise writing. Your task is to reduce the length of the following text while preserving all essential information.

Rules:
- Remove redundant words and phrases
- Eliminate unnecessary qualifiers
- Combine related sentences where possible
- Keep all critical information
- Maintain the original meaning
- Aim to reduce length by 20-40%
- Return ONLY the concise version, no explanations

Text to make concise:`,

  convert_to_bullets: `You are a document formatting expert. Your task is to convert the following text into a well-organized bullet point format.

Rules:
- Extract key points and organize them as bullet points
- Group related information together
- Use clear, concise bullet points
- Maintain logical flow and hierarchy
- Use sub-bullets for related details if needed
- Preserve all important information
- Return ONLY the bulleted version, no explanations

Text to convert to bullets:`,
};

/**
 * Text Improvement Service
 *
 * Uses Gemini AI to improve text based on the specified action type.
 */
export class TextImprovementService {
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
      temperature: 0.3,
      maxTokens: 4096,
      timeout: 30000,
      ...config,
    };

    this.model = this.client.getGenerativeModel({
      model: this.config.model,
    });
  }

  /**
   * Get the prompt for a specific improvement action
   *
   * **Requirements: 7.3**
   */
  getPromptForAction(action: ImprovementAction): string {
    const prompt = ACTION_PROMPTS[action];
    if (!prompt) {
      throw new AIServiceError(`Unknown improvement action: ${action}`, 400);
    }
    return prompt;
  }

  /**
   * Improve text using the specified action
   *
   * @param text - The text to improve
   * @param action - The improvement action to apply
   * @returns TextImprovementResult with improved text and metadata
   *
   * **Requirements: 1.1, 2.1, 3.1, 4.1, 7.1**
   */
  async improve(
    text: string,
    action: ImprovementAction
  ): Promise<TextImprovementResult> {
    try {
      const prompt = this.getPromptForAction(action);
      const fullPrompt = `${prompt}\n\n${text}`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        },
      });

      const improvedText = result.response.text();
      if (!improvedText) {
        throw new AIServiceError('Empty response from Gemini');
      }

      return {
        improvedText: improvedText.trim(),
        action,
        originalLength: text.length,
        improvedLength: improvedText.trim().length,
      };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Text improvement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Factory function to create service instance
// This avoids creating the singleton at module load time
// which would fail if GEMINI_API_KEY is not set
export function createTextImprovementService(
  config?: Partial<AIServiceConfig>
): TextImprovementService {
  return new TextImprovementService(config);
}

// Lazy singleton - only created when first accessed
let _textImprovementService: TextImprovementService | null = null;

export function getTextImprovementService(): TextImprovementService {
  if (!_textImprovementService) {
    _textImprovementService = new TextImprovementService();
  }
  return _textImprovementService;
}
