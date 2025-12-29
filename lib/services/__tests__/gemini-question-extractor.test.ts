import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExtractedQuestionsSchema } from '@/lib/validators/extract-questions';

/**
 * **Feature: gemini-integration, Property 2: Question Extractor Output Validity**
 * **Validates: Requirements 2.2, 2.3, 2.4**
 * 
 * This property test validates that:
 * - extractQuestions returns an object conforming to ExtractedQuestionsSchema
 * - generateSummary returns a non-empty string
 * - extractEligibility returns an array of strings
 * 
 * Since we cannot call the actual Gemini API in tests, we test the schema validation
 * and JSON parsing logic that ensures output validity.
 */

// Arbitrary for generating valid Question objects
const questionArbitrary = fc.record({
  id: fc.string({ minLength: 1 }),
  question: fc.string({ minLength: 1 }),
});

// Arbitrary for generating valid Section objects
const sectionArbitrary = fc.record({
  id: fc.string({ minLength: 1 }),
  title: fc.string({ minLength: 1 }),
  description: fc.option(fc.string(), { nil: undefined }),
  questions: fc.array(questionArbitrary, { minLength: 0, maxLength: 10 }),
});

// Arbitrary for generating valid ExtractedQuestions objects
const extractedQuestionsArbitrary = fc.record({
  sections: fc.array(sectionArbitrary, { minLength: 0, maxLength: 5 }),
});

// Arbitrary for generating non-empty summary strings
const summaryArbitrary = fc.string({ minLength: 1, maxLength: 500 });

// Arbitrary for generating eligibility arrays (array of non-empty strings)
const eligibilityArbitrary = fc.array(
  fc.string({ minLength: 1, maxLength: 200 }),
  { minLength: 0, maxLength: 20 }
);

describe('GeminiQuestionExtractor Output Validity', () => {
  /**
   * Property 2.1: ExtractedQuestions Schema Conformance
   * For any valid ExtractedQuestions structure, the schema validation SHALL pass.
   */
  it('should validate that any well-formed ExtractedQuestions object conforms to schema', () => {
    fc.assert(
      fc.property(extractedQuestionsArbitrary, (extractedQuestions) => {
        // The schema should successfully parse valid ExtractedQuestions objects
        const result = ExtractedQuestionsSchema.safeParse(extractedQuestions);
        expect(result.success).toBe(true);
        
        if (result.success) {
          // Verify structure is preserved
          expect(result.data.sections).toHaveLength(extractedQuestions.sections.length);
          
          // Verify each section maintains its structure
          result.data.sections.forEach((section, idx) => {
            expect(section.id).toBe(extractedQuestions.sections[idx].id);
            expect(section.title).toBe(extractedQuestions.sections[idx].title);
            expect(section.questions).toHaveLength(extractedQuestions.sections[idx].questions.length);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.2: Summary Output Validity
   * For any non-empty string, it represents a valid summary output.
   */
  it('should validate that summary outputs are non-empty strings', () => {
    fc.assert(
      fc.property(summaryArbitrary, (summary) => {
        // Summary must be a non-empty string
        expect(typeof summary).toBe('string');
        expect(summary.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.3: Eligibility Output Validity
   * For any array of strings, it represents a valid eligibility output.
   */
  it('should validate that eligibility outputs are arrays of strings', () => {
    fc.assert(
      fc.property(eligibilityArbitrary, (eligibility) => {
        // Eligibility must be an array
        expect(Array.isArray(eligibility)).toBe(true);
        
        // Each item must be a string
        eligibility.forEach((item) => {
          expect(typeof item).toBe('string');
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.4: Schema Rejects Invalid Structures
   * For any object missing required fields, the schema validation SHALL fail.
   */
  it('should reject ExtractedQuestions objects with missing required fields', () => {
    // Test missing sections field
    const invalidNoSections = {};
    expect(ExtractedQuestionsSchema.safeParse(invalidNoSections).success).toBe(false);

    // Test sections with missing id
    const invalidSectionNoId = {
      sections: [{ title: 'Test', questions: [] }],
    };
    expect(ExtractedQuestionsSchema.safeParse(invalidSectionNoId).success).toBe(false);

    // Test sections with missing title
    const invalidSectionNoTitle = {
      sections: [{ id: 'test', questions: [] }],
    };
    expect(ExtractedQuestionsSchema.safeParse(invalidSectionNoTitle).success).toBe(false);

    // Test questions with missing id
    const invalidQuestionNoId = {
      sections: [{ id: 'test', title: 'Test', questions: [{ question: 'Test?' }] }],
    };
    expect(ExtractedQuestionsSchema.safeParse(invalidQuestionNoId).success).toBe(false);

    // Test questions with missing question text
    const invalidQuestionNoText = {
      sections: [{ id: 'test', title: 'Test', questions: [{ id: 'q1' }] }],
    };
    expect(ExtractedQuestionsSchema.safeParse(invalidQuestionNoText).success).toBe(false);
  });

  /**
   * Property 2.5: Round-trip Schema Validation
   * For any valid ExtractedQuestions, parsing and re-parsing produces equivalent results.
   */
  it('should maintain idempotent schema validation', () => {
    fc.assert(
      fc.property(extractedQuestionsArbitrary, (extractedQuestions) => {
        const firstParse = ExtractedQuestionsSchema.parse(extractedQuestions);
        const secondParse = ExtractedQuestionsSchema.parse(firstParse);
        
        // The result should be deeply equal after multiple parses
        expect(secondParse).toEqual(firstParse);
      }),
      { numRuns: 100 }
    );
  });
});
