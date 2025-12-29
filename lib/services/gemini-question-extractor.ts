// Setup proxy before any network requests
import '../proxy-setup';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIQuestionExtractor, AIServiceConfig } from '@/lib/interfaces/ai-service';
import { ExtractedQuestions, ExtractedQuestionsSchema, Section } from '@/lib/validators/extract-questions';
import { DEFAULT_LANGUAGE_MODEL } from '@/lib/constants';
import { AIServiceError } from '@/lib/errors/api-errors';

// Chunk size in characters (roughly 4 chars per token, aim for ~4000 tokens per chunk)
const CHUNK_SIZE = 15000;
const CHUNK_OVERLAP = 500;

/**
 * Gemini-powered question extraction service
 */
export class GeminiQuestionExtractor implements IAIQuestionExtractor {
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
      temperature: 0.1,
      maxTokens: 4096,
      timeout: 120000,
      ...config,
    };

    this.model = this.client.getGenerativeModel({
      model: this.config.model,
    });
  }

  /**
   * Generate a summary of the RFP document
   */
  async generateSummary(content: string, documentName: string): Promise<string> {
    try {
      const systemPrompt = this.getSummarySystemPrompt();
      // Use first chunk for summary to avoid token limits
      const truncatedContent = content.substring(0, CHUNK_SIZE);
      const userPrompt = this.formatUserPrompt(truncatedContent, documentName);

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      });

      const assistantMessage = result.response.text();
      if (!assistantMessage) {
        throw new AIServiceError('Empty response from Gemini for summary generation');
      }

      return assistantMessage.trim();
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError(`Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract vendor eligibility requirements from RFP document
   */
  async extractEligibility(content: string, documentName: string): Promise<string[]> {
    try {
      // Truncate content to avoid token limits - eligibility is usually in first part
      const truncatedContent = content.substring(0, CHUNK_SIZE);
      const systemPrompt = this.getEligibilitySystemPrompt();
      const userPrompt = this.formatUserPrompt(truncatedContent, documentName);

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
        },
      });

      const assistantMessage = result.response.text();
      if (!assistantMessage) {
        throw new AIServiceError('Empty response from Gemini for eligibility extraction');
      }

      const rawData = this.extractJsonFromResponse(assistantMessage);

      if (!rawData.eligibility || !Array.isArray(rawData.eligibility)) {
        throw new AIServiceError('Invalid eligibility format from AI service');
      }

      return rawData.eligibility.filter(
        (item: unknown) => typeof item === 'string' && (item as string).trim().length > 0
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AIServiceError('Invalid JSON response from AI service for eligibility extraction');
      }
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError(`Eligibility extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Split content into overlapping chunks
   */
  private splitIntoChunks(content: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + CHUNK_SIZE, content.length);
      chunks.push(content.substring(start, end));
      start = end - CHUNK_OVERLAP;
      if (start >= content.length - CHUNK_OVERLAP) break;
    }

    return chunks;
  }

  /**
   * Extract questions from a single chunk
   */
  private async extractQuestionsFromChunk(
    chunk: string,
    chunkIndex: number,
    documentName: string
  ): Promise<Section[]> {
    const timestamp = Date.now();
    const systemPrompt = `
Extract questions from this RFP document chunk.

Return JSON: {"sections":[{"id":"s${timestamp}_${chunkIndex}_1","title":"Title","description":null,"questions":[{"id":"q${timestamp}_${chunkIndex}_1","question":"Question text"}]}]}

Rules:
- Max 5 questions per chunk
- Max 2 sections per chunk
- Keep questions concise
- Return valid complete JSON
`.trim();

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nDocument: ${documentName}\n\nContent:\n${chunk}` }] }],
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        responseMimeType: 'application/json',
      },
    });

    const assistantMessage = result.response.text();
    if (!assistantMessage) return [];

    try {
      const rawData = this.extractJsonFromResponse(assistantMessage);
      const parsed = ExtractedQuestionsSchema.parse(rawData);
      return parsed.sections;
    } catch {
      console.warn(`Failed to parse chunk ${chunkIndex}, skipping`);
      return [];
    }
  }

  /**
   * Merge sections from multiple chunks, deduplicating questions
   */
  private mergeSections(allSections: Section[]): Section[] {
    const sectionMap = new Map<string, Section>();
    const seenQuestions = new Set<string>();

    for (const section of allSections) {
      const normalizedTitle = section.title.toLowerCase().trim();
      const existing = sectionMap.get(normalizedTitle);

      const uniqueQuestions = section.questions.filter((q) => {
        const normalized = q.question.toLowerCase().trim();
        if (seenQuestions.has(normalized)) return false;
        seenQuestions.add(normalized);
        return true;
      });

      if (existing) {
        existing.questions.push(...uniqueQuestions);
      } else if (uniqueQuestions.length > 0) {
        sectionMap.set(normalizedTitle, { ...section, questions: uniqueQuestions });
      }
    }

    return Array.from(sectionMap.values());
  }

  /**
   * Extract structured questions from document content with chunking support
   */
  async extractQuestions(content: string, documentName: string): Promise<ExtractedQuestions> {
    try {
      console.log(`Processing document: ${documentName}, length: ${content.length} chars`);

      // If content is small enough, process directly
      if (content.length <= CHUNK_SIZE) {
        return this.extractQuestionsDirectly(content, documentName);
      }

      // Split into chunks and process each
      const chunks = this.splitIntoChunks(content);
      console.log(`Split into ${chunks.length} chunks`);

      const allSections: Section[] = [];

      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        const sections = await this.extractQuestionsFromChunk(chunks[i], i, documentName);
        allSections.push(...sections);
      }

      // Merge and deduplicate
      const mergedSections = this.mergeSections(allSections);

      return { sections: mergedSections };
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError(`Question extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Direct extraction for small documents
   */
  private async extractQuestionsDirectly(content: string, documentName: string): Promise<ExtractedQuestions> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.formatUserPrompt(content, documentName);

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
      throw new AIServiceError('Empty response from Gemini');
    }

    const rawData = this.extractJsonFromResponse(assistantMessage);
    return ExtractedQuestionsSchema.parse(rawData);
  }

  /**
   * Extract JSON from response, handling markdown code blocks and various formats
   */
  private extractJsonFromResponse(content: string): Record<string, unknown> {
    if (!content) throw new Error('No content to parse');

    const trimmed = content.trim();

    const strategies = [
      () => {
        const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) return JSON.parse(match[1].trim());
        return null;
      },
      () => {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return null;
      },
      () => JSON.parse(trimmed),
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result !== null) return result;
      } catch {
        // Try next strategy
      }
    }

    console.error('Failed to parse JSON from response:', trimmed.substring(0, 500));
    throw new SyntaxError('Could not extract valid JSON from response');
  }

  private getSummarySystemPrompt(): string {
    return `
You are an expert at analyzing RFP documents. Create a concise summary (3-5 sentences) covering:
1. Purpose and scope
2. Key requirements
3. Important dates
4. Vendor qualifications
5. Scale of work

Focus on substance, not administrative details.
    `.trim();
  }

  private getEligibilitySystemPrompt(): string {
    return `
Extract TOP 5 vendor eligibility requirements. Return JSON only.

Format: {"eligibility":["req1","req2","req3","req4","req5"]}

Keep each requirement under 10 words. Return {"eligibility":[]} if none found.
    `.trim();
  }

  private getSystemPrompt(): string {
    const timestamp = Date.now();
    return `
Extract questions from this RFP document.

Return JSON: {"sections":[{"id":"s${timestamp}_1","title":"Title","description":null,"questions":[{"id":"q${timestamp}_1","question":"Question?"}]}]}

Rules:
- Max 10 questions total
- Max 3 sections
- Keep questions concise
- Return complete valid JSON
    `.trim();
  }

  private formatUserPrompt(content: string, documentName: string): string {
    return `Document Name: ${documentName}\n\nDocument Content:\n${content}`;
  }
}

// Export singleton instance
export const geminiQuestionExtractor = new GeminiQuestionExtractor();
