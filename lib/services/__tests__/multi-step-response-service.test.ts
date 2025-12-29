import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  QuestionAnalysisSchema,
  InformationExtractionSchema,
  ResponseSynthesisSchema,
} from '@/lib/validators/multi-step-response';
import { extractJsonFromResponse } from '@/lib/utils/json-parser';

/**
 * **Feature: gemini-integration, Property 3: Multi-Step Service Step Output Validity**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * This property test validates that:
 * - analyzeQuestionWithAI returns a valid QuestionAnalysis object
 * - extractInformationWithAI returns a valid InformationExtraction object
 * - synthesizeResponseWithAI returns a valid ResponseSynthesis object
 *
 * Since we cannot call the actual Gemini API in tests, we test the schema validation
 * that ensures output validity for any well-formed response.
 */

// Arbitrary for generating valid QuestionAnalysis objects
const questionAnalysisArbitrary = fc.record({
  complexity: fc.constantFrom('simple', 'moderate', 'complex', 'multi-part' as const),
  requiredInformation: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  specificEntities: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
  searchQueries: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 4 }),
  expectedSources: fc.integer({ min: 1, max: 10 }),
  reasoning: fc.string({ minLength: 1 }),
});

// Arbitrary for generating valid extracted facts
const extractedFactArbitrary = fc.record({
  fact: fc.string({ minLength: 1 }),
  source: fc.string({ minLength: 1 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
});

// Arbitrary for generating conflicting information
const conflictingInfoArbitrary = fc.record({
  topic: fc.string({ minLength: 1 }),
  conflictingSources: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
});

// Arbitrary for generating valid InformationExtraction objects
const informationExtractionArbitrary = fc.record({
  extractedFacts: fc.array(extractedFactArbitrary, { minLength: 0, maxLength: 10 }),
  missingInformation: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
  conflictingInformation: fc.array(conflictingInfoArbitrary, { minLength: 0, maxLength: 3 }),
});

// Arbitrary for generating valid source references
const sourceReferenceArbitrary = fc.record({
  id: fc.string({ minLength: 1 }),
  relevance: fc.double({ min: 0, max: 1, noNaN: true }),
  usedInResponse: fc.boolean(),
});

// Arbitrary for generating valid ResponseSynthesis objects
const responseSynthesisArbitrary = fc.record({
  mainResponse: fc.string({ minLength: 1 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  sources: fc.array(sourceReferenceArbitrary, { minLength: 0, maxLength: 10 }),
  limitations: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
  recommendations: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
});

describe('MultiStepResponseService Step Output Validity', () => {
  /**
   * Property 3.1: QuestionAnalysis Schema Conformance
   * For any valid QuestionAnalysis structure, the schema validation SHALL pass.
   */
  it('should validate that any well-formed QuestionAnalysis object conforms to schema', () => {
    fc.assert(
      fc.property(questionAnalysisArbitrary, (analysis) => {
        const result = QuestionAnalysisSchema.safeParse(analysis);
        expect(result.success).toBe(true);

        if (result.success) {
          // Verify structure is preserved
          expect(result.data.complexity).toBe(analysis.complexity);
          expect(result.data.requiredInformation).toEqual(analysis.requiredInformation);
          expect(result.data.specificEntities).toEqual(analysis.specificEntities);
          expect(result.data.searchQueries).toEqual(analysis.searchQueries);
          expect(result.data.expectedSources).toBe(analysis.expectedSources);
          expect(result.data.reasoning).toBe(analysis.reasoning);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.2: InformationExtraction Schema Conformance
   * For any valid InformationExtraction structure, the schema validation SHALL pass.
   */
  it('should validate that any well-formed InformationExtraction object conforms to schema', () => {
    fc.assert(
      fc.property(informationExtractionArbitrary, (extraction) => {
        const result = InformationExtractionSchema.safeParse(extraction);
        expect(result.success).toBe(true);

        if (result.success) {
          // Verify structure is preserved
          expect(result.data.extractedFacts).toHaveLength(extraction.extractedFacts.length);
          expect(result.data.missingInformation).toEqual(extraction.missingInformation);
          expect(result.data.conflictingInformation).toHaveLength(
            extraction.conflictingInformation.length
          );

          // Verify each fact maintains its structure
          result.data.extractedFacts.forEach((fact, idx) => {
            expect(fact.fact).toBe(extraction.extractedFacts[idx].fact);
            expect(fact.source).toBe(extraction.extractedFacts[idx].source);
            expect(fact.confidence).toBe(extraction.extractedFacts[idx].confidence);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: ResponseSynthesis Schema Conformance
   * For any valid ResponseSynthesis structure, the schema validation SHALL pass.
   */
  it('should validate that any well-formed ResponseSynthesis object conforms to schema', () => {
    fc.assert(
      fc.property(responseSynthesisArbitrary, (synthesis) => {
        const result = ResponseSynthesisSchema.safeParse(synthesis);
        expect(result.success).toBe(true);

        if (result.success) {
          // Verify structure is preserved
          expect(result.data.mainResponse).toBe(synthesis.mainResponse);
          expect(result.data.confidence).toBe(synthesis.confidence);
          expect(result.data.sources).toHaveLength(synthesis.sources.length);
          expect(result.data.limitations).toEqual(synthesis.limitations);
          expect(result.data.recommendations).toEqual(synthesis.recommendations);

          // Verify each source maintains its structure
          result.data.sources.forEach((source, idx) => {
            expect(source.id).toBe(synthesis.sources[idx].id);
            expect(source.relevance).toBe(synthesis.sources[idx].relevance);
            expect(source.usedInResponse).toBe(synthesis.sources[idx].usedInResponse);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.4: Schema Rejects Invalid QuestionAnalysis Structures
   * For any object missing required fields, the schema validation SHALL fail.
   */
  it('should reject QuestionAnalysis objects with missing required fields', () => {
    // Test missing complexity
    const invalidNoComplexity = {
      requiredInformation: ['info'],
      specificEntities: [],
      searchQueries: ['query'],
      expectedSources: 2,
      reasoning: 'test',
    };
    expect(QuestionAnalysisSchema.safeParse(invalidNoComplexity).success).toBe(false);

    // Test invalid complexity value
    const invalidComplexity = {
      complexity: 'invalid',
      requiredInformation: ['info'],
      specificEntities: [],
      searchQueries: ['query'],
      expectedSources: 2,
      reasoning: 'test',
    };
    expect(QuestionAnalysisSchema.safeParse(invalidComplexity).success).toBe(false);

    // Test missing searchQueries
    const invalidNoQueries = {
      complexity: 'simple',
      requiredInformation: ['info'],
      specificEntities: [],
      expectedSources: 2,
      reasoning: 'test',
    };
    expect(QuestionAnalysisSchema.safeParse(invalidNoQueries).success).toBe(false);
  });

  /**
   * Property 3.5: Schema Rejects Invalid InformationExtraction Structures
   * For any object missing required fields, the schema validation SHALL fail.
   */
  it('should reject InformationExtraction objects with missing required fields', () => {
    // Test missing extractedFacts
    const invalidNoFacts = {
      missingInformation: [],
      conflictingInformation: [],
    };
    expect(InformationExtractionSchema.safeParse(invalidNoFacts).success).toBe(false);

    // Test invalid fact structure (missing confidence)
    const invalidFactStructure = {
      extractedFacts: [{ fact: 'test', source: 'doc' }],
      missingInformation: [],
      conflictingInformation: [],
    };
    expect(InformationExtractionSchema.safeParse(invalidFactStructure).success).toBe(false);

    // Test invalid conflicting info structure
    const invalidConflictStructure = {
      extractedFacts: [],
      missingInformation: [],
      conflictingInformation: [{ topic: 'test' }], // missing conflictingSources
    };
    expect(InformationExtractionSchema.safeParse(invalidConflictStructure).success).toBe(false);
  });

  /**
   * Property 3.6: Schema Rejects Invalid ResponseSynthesis Structures
   * For any object missing required fields, the schema validation SHALL fail.
   */
  it('should reject ResponseSynthesis objects with missing required fields', () => {
    // Test missing mainResponse
    const invalidNoResponse = {
      confidence: 0.8,
      sources: [],
      limitations: [],
      recommendations: [],
    };
    expect(ResponseSynthesisSchema.safeParse(invalidNoResponse).success).toBe(false);

    // Test invalid source structure (missing usedInResponse)
    const invalidSourceStructure = {
      mainResponse: 'test',
      confidence: 0.8,
      sources: [{ id: '1', relevance: 0.9 }],
      limitations: [],
      recommendations: [],
    };
    expect(ResponseSynthesisSchema.safeParse(invalidSourceStructure).success).toBe(false);

    // Test missing confidence
    const invalidNoConfidence = {
      mainResponse: 'test',
      sources: [],
      limitations: [],
      recommendations: [],
    };
    expect(ResponseSynthesisSchema.safeParse(invalidNoConfidence).success).toBe(false);
  });

  /**
   * Property 3.7: Round-trip Schema Validation for QuestionAnalysis
   * For any valid QuestionAnalysis, parsing and re-parsing produces equivalent results.
   */
  it('should maintain idempotent schema validation for QuestionAnalysis', () => {
    fc.assert(
      fc.property(questionAnalysisArbitrary, (analysis) => {
        const firstParse = QuestionAnalysisSchema.parse(analysis);
        const secondParse = QuestionAnalysisSchema.parse(firstParse);

        expect(secondParse).toEqual(firstParse);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.8: Round-trip Schema Validation for InformationExtraction
   * For any valid InformationExtraction, parsing and re-parsing produces equivalent results.
   */
  it('should maintain idempotent schema validation for InformationExtraction', () => {
    fc.assert(
      fc.property(informationExtractionArbitrary, (extraction) => {
        const firstParse = InformationExtractionSchema.parse(extraction);
        const secondParse = InformationExtractionSchema.parse(firstParse);

        expect(secondParse).toEqual(firstParse);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.9: Round-trip Schema Validation for ResponseSynthesis
   * For any valid ResponseSynthesis, parsing and re-parsing produces equivalent results.
   */
  it('should maintain idempotent schema validation for ResponseSynthesis', () => {
    fc.assert(
      fc.property(responseSynthesisArbitrary, (synthesis) => {
        const firstParse = ResponseSynthesisSchema.parse(synthesis);
        const secondParse = ResponseSynthesisSchema.parse(firstParse);

        expect(secondParse).toEqual(firstParse);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: gemini-integration, Property 4: JSON Parsing from Markdown Code Blocks**
 * **Validates: Requirements 3.5**
 *
 * This property test validates that:
 * - For any string containing JSON wrapped in markdown code blocks (```json ... ```),
 *   the extractJsonFromResponse method correctly extracts and parses the JSON content,
 *   returning the same object as if the JSON were not wrapped.
 */
describe('JSON Parsing from Markdown Code Blocks', () => {
  // Arbitrary for generating valid JSON-serializable objects
  const jsonObjectArbitrary = fc.oneof(
    fc.record({
      complexity: fc.constantFrom('simple', 'moderate', 'complex', 'multi-part'),
      requiredInformation: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
      specificEntities: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 3 }),
      searchQueries: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
      expectedSources: fc.integer({ min: 1, max: 10 }),
      reasoning: fc.string({ minLength: 1 }),
    }),
    fc.record({
      mainResponse: fc.string({ minLength: 1 }),
      confidence: fc.double({ min: 0, max: 1, noNaN: true }),
      sources: fc.array(
        fc.record({
          id: fc.string({ minLength: 1 }),
          relevance: fc.double({ min: 0, max: 1, noNaN: true }),
          usedInResponse: fc.boolean(),
        }),
        { minLength: 0, maxLength: 3 }
      ),
      limitations: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 3 }),
      recommendations: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 3 }),
    }),
    fc.record({
      extractedFacts: fc.array(
        fc.record({
          fact: fc.string({ minLength: 1 }),
          source: fc.string({ minLength: 1 }),
          confidence: fc.double({ min: 0, max: 1, noNaN: true }),
        }),
        { minLength: 0, maxLength: 3 }
      ),
      missingInformation: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 3 }),
      conflictingInformation: fc.array(
        fc.record({
          topic: fc.string({ minLength: 1 }),
          conflictingSources: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 3 }),
        }),
        { minLength: 0, maxLength: 2 }
      ),
    })
  );

  /**
   * Property 4.1: Raw JSON Parsing
   * For any valid JSON object, parsing the raw JSON string produces the original object.
   */
  it('should correctly parse raw JSON strings', () => {
    fc.assert(
      fc.property(jsonObjectArbitrary, (obj) => {
        const jsonString = JSON.stringify(obj);
        const parsed = extractJsonFromResponse(jsonString);
        expect(parsed).toEqual(obj);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.2: JSON in ```json code blocks
   * For any valid JSON object wrapped in ```json ... ```, parsing produces the original object.
   */
  it('should correctly parse JSON wrapped in ```json code blocks', () => {
    fc.assert(
      fc.property(jsonObjectArbitrary, (obj) => {
        const jsonString = JSON.stringify(obj);
        const wrappedJson = '```json\n' + jsonString + '\n```';
        const parsed = extractJsonFromResponse(wrappedJson);
        expect(parsed).toEqual(obj);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.3: JSON in plain ``` code blocks
   * For any valid JSON object wrapped in ``` ... ```, parsing produces the original object.
   */
  it('should correctly parse JSON wrapped in plain ``` code blocks', () => {
    fc.assert(
      fc.property(jsonObjectArbitrary, (obj) => {
        const jsonString = JSON.stringify(obj);
        const wrappedJson = '```\n' + jsonString + '\n```';
        const parsed = extractJsonFromResponse(wrappedJson);
        expect(parsed).toEqual(obj);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.4: Round-trip equivalence
   * For any valid JSON object, parsing raw JSON and parsing wrapped JSON produce equivalent results.
   */
  it('should produce equivalent results for raw and wrapped JSON', () => {
    fc.assert(
      fc.property(jsonObjectArbitrary, (obj) => {
        const jsonString = JSON.stringify(obj);
        const wrappedJson = '```json\n' + jsonString + '\n```';

        const parsedRaw = extractJsonFromResponse(jsonString);
        const parsedWrapped = extractJsonFromResponse(wrappedJson);

        expect(parsedRaw).toEqual(parsedWrapped);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.5: Whitespace handling in code blocks
   * For any valid JSON object, extra whitespace around the JSON in code blocks is handled correctly.
   */
  it('should handle extra whitespace in code blocks', () => {
    fc.assert(
      fc.property(
        jsonObjectArbitrary,
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 3 }),
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 3 }),
        (obj, leadingWs, trailingWs) => {
          const jsonString = JSON.stringify(obj);
          const wrappedJson = '```json' + leadingWs + jsonString + trailingWs + '```';
          const parsed = extractJsonFromResponse(wrappedJson);
          expect(parsed).toEqual(obj);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.6: Empty content throws error
   * For empty or null content, the function should throw an error.
   */
  it('should throw error for empty content', () => {
    expect(() => extractJsonFromResponse('')).toThrow('No content to parse');
    expect(() => extractJsonFromResponse(null as unknown as string)).toThrow('No content to parse');
    expect(() => extractJsonFromResponse(undefined as unknown as string)).toThrow(
      'No content to parse'
    );
  });

  /**
   * Property 4.7: Invalid JSON throws error
   * For invalid JSON content, the function should throw a parse error.
   */
  it('should throw error for invalid JSON', () => {
    expect(() => extractJsonFromResponse('not valid json')).toThrow();
    expect(() => extractJsonFromResponse('```json\nnot valid json\n```')).toThrow();
    expect(() => extractJsonFromResponse('{incomplete')).toThrow();
  });
});
