/**
 * Property-based tests for source display utilities
 * 
 * **Feature: source-display-improvement**
 * 
 * These tests verify the correctness properties for source relevance
 * color mapping and source sorting using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getRelevanceColor, sortSourcesByRelevance, appendSourceContent, type RelevanceColor } from '@/lib/utils/source-utils';
import { sourcePanelUtils } from '@/hooks/use-source-panel';
import { hasUsableContent } from '@/components/ui/source-card';
import { getSourceCount, shouldShowNoSourceWarning } from '@/components/ui/source-panel';
import type { AnswerSource } from '@/types/api';

const { parseStoredState, serializeState, STORAGE_KEY, DEFAULT_EXPANDED } = sourcePanelUtils;

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid relevance scores (0-100)
 */
const relevanceScoreArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 100 });

/**
 * Generator for high relevance scores (>= 70)
 */
const highRelevanceArb: fc.Arbitrary<number> = fc.integer({ min: 70, max: 100 });

/**
 * Generator for medium relevance scores (40-69)
 */
const mediumRelevanceArb: fc.Arbitrary<number> = fc.integer({ min: 40, max: 69 });

/**
 * Generator for low relevance scores (0-39)
 */
const lowRelevanceArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 39 });

/**
 * Generator for nullable relevance (null or undefined)
 */
const nullableRelevanceArb: fc.Arbitrary<null | undefined> = fc.constantFrom(null, undefined);

/**
 * Generator for AnswerSource objects
 */
const answerSourceArb = (relevance?: fc.Arbitrary<number | null | undefined>): fc.Arbitrary<AnswerSource> => {
  const relevanceGen = relevance ?? fc.option(relevanceScoreArb, { nil: null });
  
  return fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    fileName: fc.string({ minLength: 1, maxLength: 50 }),
    filePath: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    pageNumber: fc.option(fc.oneof(fc.string(), fc.integer({ min: 1, max: 1000 })), { nil: undefined }),
    documentId: fc.option(fc.uuid(), { nil: undefined }),
    relevance: relevanceGen,
    textContent: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
  });
};

/**
 * Generator for arrays of AnswerSource objects
 */
const answerSourceArrayArb: fc.Arbitrary<AnswerSource[]> = fc.array(answerSourceArb(), { minLength: 0, maxLength: 20 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Source Display Property Tests', () => {
  /**
   * **Feature: source-display-improvement, Property 3: Relevance Color Mapping**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   * 
   * For any relevance score, the getRelevanceColor function SHALL return:
   * - 'green' when relevance >= 70
   * - 'amber' when relevance >= 40 and < 70
   * - 'red' when relevance < 40 or null/undefined
   */
  describe('Property 3: Relevance Color Mapping', () => {
    it('should return green for high relevance scores (>= 70)', () => {
      fc.assert(
        fc.property(highRelevanceArb, (relevance) => {
          const color = getRelevanceColor(relevance);
          expect(color).toBe('green');
        }),
        { numRuns: 100 }
      );
    });

    it('should return amber for medium relevance scores (40-69)', () => {
      fc.assert(
        fc.property(mediumRelevanceArb, (relevance) => {
          const color = getRelevanceColor(relevance);
          expect(color).toBe('amber');
        }),
        { numRuns: 100 }
      );
    });

    it('should return red for low relevance scores (< 40)', () => {
      fc.assert(
        fc.property(lowRelevanceArb, (relevance) => {
          const color = getRelevanceColor(relevance);
          expect(color).toBe('red');
        }),
        { numRuns: 100 }
      );
    });

    it('should return red for null or undefined relevance', () => {
      fc.assert(
        fc.property(nullableRelevanceArb, (relevance) => {
          const color = getRelevanceColor(relevance);
          expect(color).toBe('red');
        }),
        { numRuns: 100 }
      );
    });

    it('should always return a valid RelevanceColor for any relevance score', () => {
      fc.assert(
        fc.property(
          fc.option(relevanceScoreArb, { nil: null }),
          (relevance) => {
            const color = getRelevanceColor(relevance);
            expect(['green', 'amber', 'red']).toContain(color);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent color boundaries', () => {
      // Test boundary at 70
      expect(getRelevanceColor(70)).toBe('green');
      expect(getRelevanceColor(69)).toBe('amber');
      
      // Test boundary at 40
      expect(getRelevanceColor(40)).toBe('amber');
      expect(getRelevanceColor(39)).toBe('red');
    });
  });

  /**
   * **Feature: source-display-improvement, Property 2: Source Sorting by Relevance**
   * **Validates: Requirements 4.3**
   * 
   * For any array of sources with varying relevance scores, the sortSourcesByRelevance
   * function SHALL return sources sorted in descending order by relevance score.
   */
  describe('Property 2: Source Sorting by Relevance', () => {
    it('should sort sources in descending order by relevance', () => {
      fc.assert(
        fc.property(answerSourceArrayArb, (sources) => {
          const sorted = sortSourcesByRelevance(sources);
          
          // Check that the result is sorted in descending order
          for (let i = 0; i < sorted.length - 1; i++) {
            const currentRelevance = sorted[i].relevance ?? 0;
            const nextRelevance = sorted[i + 1].relevance ?? 0;
            expect(currentRelevance).toBeGreaterThanOrEqual(nextRelevance);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all sources (same length)', () => {
      fc.assert(
        fc.property(answerSourceArrayArb, (sources) => {
          const sorted = sortSourcesByRelevance(sources);
          expect(sorted.length).toBe(sources.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should not mutate the original array', () => {
      fc.assert(
        fc.property(answerSourceArrayArb, (sources) => {
          const originalCopy = [...sources];
          sortSourcesByRelevance(sources);
          
          // Original array should be unchanged
          expect(sources).toEqual(originalCopy);
        }),
        { numRuns: 100 }
      );
    });

    it('should treat null/undefined relevance as 0', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              answerSourceArb(fc.constant(null)),
              answerSourceArb(fc.constant(undefined)),
              answerSourceArb(fc.integer({ min: 1, max: 100 }))
            ),
            { minLength: 2, maxLength: 10 }
          ),
          (sources) => {
            const sorted = sortSourcesByRelevance(sources);
            
            // Sources with null/undefined should be at the end (treated as 0)
            const nullSources = sorted.filter(s => s.relevance === null || s.relevance === undefined);
            const nonNullSources = sorted.filter(s => s.relevance !== null && s.relevance !== undefined);
            
            // All non-null sources should come before null sources (if non-null have relevance > 0)
            if (nonNullSources.length > 0 && nullSources.length > 0) {
              const lastNonNullIndex = sorted.findIndex(s => s.relevance === null || s.relevance === undefined) - 1;
              if (lastNonNullIndex >= 0) {
                const lastNonNullRelevance = sorted[lastNonNullIndex].relevance ?? 0;
                expect(lastNonNullRelevance).toBeGreaterThanOrEqual(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for empty input', () => {
      const sorted = sortSourcesByRelevance([]);
      expect(sorted).toEqual([]);
    });
  });

  /**
   * **Feature: source-display-improvement, Property 6: Panel State Round-Trip**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any panel expanded state, storing to localStorage and then retrieving
   * SHALL return the same state value.
   */
  describe('Property 6: Panel State Round-Trip', () => {
    it('should return the same state after serialize then parse', () => {
      fc.assert(
        fc.property(fc.boolean(), (expanded) => {
          // Serialize the state
          const serialized = serializeState(expanded);
          
          // Parse it back
          const parsed = parseStoredState(serialized);
          
          // The state should be the same
          expect(parsed).toBe(expanded);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve state through multiple round-trips', () => {
      fc.assert(
        fc.property(fc.boolean(), (expanded) => {
          // First round-trip
          const serialized1 = serializeState(expanded);
          const parsed1 = parseStoredState(serialized1);
          
          expect(parsed1).not.toBeNull();
          
          // Second round-trip using the parsed state
          const serialized2 = serializeState(parsed1!);
          const parsed2 = parseStoredState(serialized2);
          
          // State should still be the same
          expect(parsed2).toBe(expanded);
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false; // Valid JSON, filter it out
            } catch {
              return true; // Invalid JSON, keep it
            }
          }),
          (invalidJson) => {
            const parsed = parseStoredState(invalidJson);
            expect(parsed).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for null input', () => {
      const parsed = parseStoredState(null);
      expect(parsed).toBeNull();
    });

    it('should return null for JSON with non-boolean value', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.array(fc.anything()),
            fc.object()
          ),
          (nonBooleanValue) => {
            const invalidState = JSON.stringify(nonBooleanValue);
            const parsed = parseStoredState(invalidState);
            expect(parsed).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have the correct storage key', () => {
      expect(STORAGE_KEY).toBe('autorpf_source_panel_expanded');
    });

    it('should default to collapsed (false)', () => {
      expect(DEFAULT_EXPANDED).toBe(false);
    });
  });

  /**
   * **Feature: source-display-improvement, Property 4: Use Button Disabled State**
   * **Validates: Requirements 5.4**
   * 
   * For any source with null, undefined, or empty string textContent,
   * the Use button SHALL be disabled.
   */
  describe('Property 4: Use Button Disabled State', () => {
    /**
     * Generator for whitespace-only strings
     */
    const whitespaceOnlyArb: fc.Arbitrary<string> = fc.array(
      fc.constantFrom(' ', '\t', '\n', '\r'),
      { minLength: 1, maxLength: 10 }
    ).map(chars => chars.join(''));

    /**
     * Generator for sources with empty/null/undefined textContent
     */
    const emptyTextContentArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(''),
      whitespaceOnlyArb
    );

    /**
     * Generator for sources with valid (non-empty) textContent
     */
    const validTextContentArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 500 })
      .filter(s => s.trim().length > 0);

    /**
     * Generator for AnswerSource with specific textContent
     */
    const sourceWithTextContent = (textContent: fc.Arbitrary<string | null | undefined>): fc.Arbitrary<AnswerSource> => {
      return fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        fileName: fc.string({ minLength: 1, maxLength: 50 }),
        filePath: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        pageNumber: fc.option(fc.oneof(fc.string(), fc.integer({ min: 1, max: 1000 })), { nil: undefined }),
        documentId: fc.option(fc.uuid(), { nil: undefined }),
        relevance: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
        textContent: textContent,
      });
    };

    it('should return false (disabled) for sources with null textContent', () => {
      fc.assert(
        fc.property(sourceWithTextContent(fc.constant(null)), (source) => {
          expect(hasUsableContent(source)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false (disabled) for sources with undefined textContent', () => {
      fc.assert(
        fc.property(sourceWithTextContent(fc.constant(undefined)), (source) => {
          expect(hasUsableContent(source)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false (disabled) for sources with empty string textContent', () => {
      fc.assert(
        fc.property(sourceWithTextContent(fc.constant('')), (source) => {
          expect(hasUsableContent(source)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false (disabled) for sources with whitespace-only textContent', () => {
      fc.assert(
        fc.property(
          sourceWithTextContent(whitespaceOnlyArb),
          (source) => {
            expect(hasUsableContent(source)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return true (enabled) for sources with valid non-empty textContent', () => {
      fc.assert(
        fc.property(sourceWithTextContent(validTextContentArb), (source) => {
          expect(hasUsableContent(source)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify usable content for any source', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            sourceWithTextContent(emptyTextContentArb),
            sourceWithTextContent(validTextContentArb)
          ),
          (source) => {
            const result = hasUsableContent(source);
            const expectedUsable = source.textContent !== null && 
                                   source.textContent !== undefined && 
                                   source.textContent.trim() !== '';
            expect(result).toBe(expectedUsable);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: source-display-improvement, Property 1: Source Count Accuracy**
   * **Validates: Requirements 1.2**
   * 
   * For any array of sources passed to SourcePanel, the displayed count
   * SHALL equal the length of the source array.
   */
  describe('Property 1: Source Count Accuracy', () => {
    it('should return count equal to array length for any source array', () => {
      fc.assert(
        fc.property(answerSourceArrayArb, (sources) => {
          const count = getSourceCount(sources);
          expect(count).toBe(sources.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should return 0 for empty array', () => {
      const count = getSourceCount([]);
      expect(count).toBe(0);
    });

    it('should return 1 for single-element array', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const count = getSourceCount([source]);
          expect(count).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should return exact count regardless of source content', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (expectedCount) => {
            // Generate exactly expectedCount sources
            const sources: AnswerSource[] = Array.from({ length: expectedCount }, (_, i) => ({
              id: i + 1,
              fileName: `file${i}.pdf`,
              relevance: Math.floor(Math.random() * 100),
              textContent: null,
            }));
            
            const count = getSourceCount(sources);
            expect(count).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: source-display-improvement, Property 7: No Source Warning Display**
   * **Validates: Requirements 3.1**
   * 
   * For any empty source array (length === 0), the NoSourceWarning component
   * SHALL be rendered.
   */
  describe('Property 7: No Source Warning Display', () => {
    it('should return true for empty source array', () => {
      const result = shouldShowNoSourceWarning([]);
      expect(result).toBe(true);
    });

    it('should return false for non-empty source array', () => {
      fc.assert(
        fc.property(
          fc.array(answerSourceArb(), { minLength: 1, maxLength: 20 }),
          (sources) => {
            const result = shouldShowNoSourceWarning(sources);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly determine warning display for any source array', () => {
      fc.assert(
        fc.property(answerSourceArrayArb, (sources) => {
          const result = shouldShowNoSourceWarning(sources);
          const expected = sources.length === 0;
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for single source', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const result = shouldShowNoSourceWarning([source]);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: source-display-improvement, Property 5: Content Append Behavior**
   * **Validates: Requirements 5.2**
   * 
   * For any current answer text and source textContent, clicking Use SHALL result
   * in the answer containing the original text followed by the source content.
   */
  describe('Property 5: Content Append Behavior', () => {
    /**
     * Generator for non-empty text content
     */
    const nonEmptyTextArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 500 })
      .filter(s => s.trim().length > 0);

    /**
     * Generator for whitespace-only strings
     */
    const whitespaceOnlyArb: fc.Arbitrary<string> = fc.array(
      fc.constantFrom(' ', '\t', '\n', '\r'),
      { minLength: 0, maxLength: 10 }
    ).map(chars => chars.join(''));

    it('should append source content with separator when current text is non-empty', () => {
      fc.assert(
        fc.property(nonEmptyTextArb, nonEmptyTextArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // Result should contain original text
          expect(result.startsWith(currentText)).toBe(true);
          
          // Result should contain source content
          expect(result.endsWith(sourceContent)).toBe(true);
          
          // Result should have separator between them
          expect(result).toBe(currentText + '\n\n' + sourceContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should return source content directly when current text is empty', () => {
      fc.assert(
        fc.property(nonEmptyTextArb, (sourceContent) => {
          const result = appendSourceContent('', sourceContent);
          expect(result).toBe(sourceContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should return source content directly when current text is whitespace-only', () => {
      fc.assert(
        fc.property(whitespaceOnlyArb, nonEmptyTextArb, (whitespace, sourceContent) => {
          const result = appendSourceContent(whitespace, sourceContent);
          expect(result).toBe(sourceContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve original text content after append', () => {
      fc.assert(
        fc.property(nonEmptyTextArb, nonEmptyTextArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // The original text should be preserved at the start
          expect(result.indexOf(currentText)).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve source content after append', () => {
      fc.assert(
        fc.property(nonEmptyTextArb, nonEmptyTextArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // The source content should be preserved at the end
          expect(result.endsWith(sourceContent)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple appends correctly', () => {
      fc.assert(
        fc.property(
          fc.array(nonEmptyTextArb, { minLength: 2, maxLength: 5 }),
          (contents) => {
            let result = '';
            
            for (const content of contents) {
              result = appendSourceContent(result, content);
            }
            
            // All contents should be present in the result
            for (const content of contents) {
              expect(result.includes(content)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use double newline as separator', () => {
      fc.assert(
        fc.property(nonEmptyTextArb, nonEmptyTextArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // Check that the separator is exactly '\n\n'
          const expectedSeparatorIndex = currentText.length;
          const actualSeparator = result.slice(expectedSeparatorIndex, expectedSeparatorIndex + 2);
          expect(actualSeparator).toBe('\n\n');
        }),
        { numRuns: 100 }
      );
    });
  });
});
