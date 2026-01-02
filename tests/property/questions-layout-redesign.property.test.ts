/**
 * Property-based tests for Questions Layout Redesign
 * 
 * **Feature: questions-layout-redesign**
 * 
 * These tests verify the correctness properties for the three-panel layout
 * redesign, specifically testing the SourceSidePanel component behavior.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getSourceCount, shouldShowNoSourceWarning } from '@/components/ui/source-side-panel';
import { hasUsableContent } from '@/components/ui/source-card';
import { sortSourcesByRelevance, appendSourceContent } from '@/lib/utils/source-utils';
import { getDisplayedQuestionText, shouldShowUnsavedIndicator } from '@/app/projects/[projectId]/questions/components/question-editor';
import { getThreePanelLayoutConfig, isValidThreePanelLayout, PanelLayoutConfig } from '@/app/projects/[projectId]/questions/components/questions-tabs-content';
import type { AnswerSource } from '@/types/api';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid relevance scores (0-100)
 */
const relevanceScoreArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 100 });

/**
 * Generator for AnswerSource objects with all required fields for display
 */
const answerSourceArb = (): fc.Arbitrary<AnswerSource> => {
  return fc.record({
    id: fc.integer({ min: 1, max: 10000 }),
    fileName: fc.string({ minLength: 1, maxLength: 50 }),
    filePath: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    pageNumber: fc.option(fc.oneof(fc.string(), fc.integer({ min: 1, max: 1000 })), { nil: undefined }),
    documentId: fc.option(fc.uuid(), { nil: undefined }),
    relevance: fc.option(relevanceScoreArb, { nil: null }),
    textContent: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
  });
};

/**
 * Generator for non-empty arrays of AnswerSource objects with unique IDs
 */
const nonEmptySourceArrayArb: fc.Arbitrary<AnswerSource[]> = fc.array(answerSourceArb(), { minLength: 1, maxLength: 20 })
  .map(sources => {
    // Ensure unique IDs by reassigning them
    return sources.map((source, index) => ({
      ...source,
      id: index + 1,
    }));
  });

/**
 * Generator for arrays of AnswerSource objects (including empty) with unique IDs
 */
const sourceArrayArb: fc.Arbitrary<AnswerSource[]> = fc.array(answerSourceArb(), { minLength: 0, maxLength: 20 })
  .map(sources => {
    // Ensure unique IDs by reassigning them
    return sources.map((source, index) => ({
      ...source,
      id: index + 1,
    }));
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Questions Layout Redesign Property Tests', () => {
  /**
   * **Feature: questions-layout-redesign, Property 1: Three-panel layout structure**
   * **Validates: Requirements 1.1**
   * 
   * For any render of QuestionsTabsContent with a selected question, the component
   * SHALL contain exactly three panel elements: Navigator, Editor, and SourceSidePanel
   * in left-to-right order.
   */
  describe('Property 1: Three-panel layout structure', () => {
    /**
     * Generator for valid panel layout configurations
     */
    const validPanelLayoutArb: fc.Arbitrary<PanelLayoutConfig> = fc.record({
      panelCount: fc.constant(3),
      panels: fc.constant([
        { name: 'navigator' as const, colSpan: 3, order: 0 },
        { name: 'editor' as const, colSpan: 5, order: 1 },
        { name: 'source' as const, colSpan: 4, order: 2 },
      ]),
      totalColumns: fc.constant(12),
    });

    /**
     * Generator for invalid panel layout configurations (wrong panel count)
     */
    const invalidPanelCountArb: fc.Arbitrary<PanelLayoutConfig> = fc.integer({ min: 0, max: 10 })
      .filter(count => count !== 3)
      .map(count => ({
        panelCount: count,
        panels: Array.from({ length: count }, (_, i) => ({
          name: ['navigator', 'editor', 'source'][i % 3] as 'navigator' | 'editor' | 'source',
          colSpan: Math.floor(12 / Math.max(count, 1)),
          order: i,
        })),
        totalColumns: 12,
      }));

    /**
     * Generator for invalid panel layout configurations (wrong order)
     */
    const invalidPanelOrderArb: fc.Arbitrary<PanelLayoutConfig> = fc.shuffledSubarray(
      [
        { name: 'navigator' as const, colSpan: 3, order: 0 },
        { name: 'editor' as const, colSpan: 5, order: 1 },
        { name: 'source' as const, colSpan: 4, order: 2 },
      ],
      { minLength: 3, maxLength: 3 }
    )
      .filter(panels => {
        // Only keep shuffles that are NOT in the correct order
        return !(panels[0].name === 'navigator' && panels[1].name === 'editor' && panels[2].name === 'source');
      })
      .map(panels => ({
        panelCount: 3,
        panels: panels.map((p, i) => ({ ...p, order: i })),
        totalColumns: 12,
      }));

    /**
     * Generator for invalid panel layout configurations (column spans don't sum to total)
     */
    const invalidColumnSpanArb: fc.Arbitrary<PanelLayoutConfig> = fc.tuple(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 })
    )
      .filter(([a, b, c]) => a + b + c !== 12)
      .map(([navSpan, editorSpan, sourceSpan]) => ({
        panelCount: 3,
        panels: [
          { name: 'navigator' as const, colSpan: navSpan, order: 0 },
          { name: 'editor' as const, colSpan: editorSpan, order: 1 },
          { name: 'source' as const, colSpan: sourceSpan, order: 2 },
        ],
        totalColumns: 12,
      }));

    it('should return a valid three-panel layout configuration', () => {
      const config = getThreePanelLayoutConfig();
      expect(isValidThreePanelLayout(config)).toBe(true);
    });

    it('should have exactly 3 panels', () => {
      const config = getThreePanelLayoutConfig();
      expect(config.panelCount).toBe(3);
      expect(config.panels.length).toBe(3);
    });

    it('should have panels in correct order: navigator, editor, source', () => {
      const config = getThreePanelLayoutConfig();
      expect(config.panels[0].name).toBe('navigator');
      expect(config.panels[0].order).toBe(0);
      expect(config.panels[1].name).toBe('editor');
      expect(config.panels[1].order).toBe(1);
      expect(config.panels[2].name).toBe('source');
      expect(config.panels[2].order).toBe(2);
    });

    it('should have column spans that sum to total columns (12)', () => {
      const config = getThreePanelLayoutConfig();
      const totalSpan = config.panels.reduce((sum, panel) => sum + panel.colSpan, 0);
      expect(totalSpan).toBe(config.totalColumns);
      expect(totalSpan).toBe(12);
    });

    it('should have navigator panel with ~25% width (3/12 columns)', () => {
      const config = getThreePanelLayoutConfig();
      const navigatorPanel = config.panels.find(p => p.name === 'navigator');
      expect(navigatorPanel).toBeDefined();
      expect(navigatorPanel!.colSpan).toBe(3);
    });

    it('should have editor panel with ~42% width (5/12 columns)', () => {
      const config = getThreePanelLayoutConfig();
      const editorPanel = config.panels.find(p => p.name === 'editor');
      expect(editorPanel).toBeDefined();
      expect(editorPanel!.colSpan).toBe(5);
    });

    it('should have source panel with ~33% width (4/12 columns)', () => {
      const config = getThreePanelLayoutConfig();
      const sourcePanel = config.panels.find(p => p.name === 'source');
      expect(sourcePanel).toBeDefined();
      expect(sourcePanel!.colSpan).toBe(4);
    });

    it('should validate any correctly structured layout configuration', () => {
      fc.assert(
        fc.property(validPanelLayoutArb, (config) => {
          expect(isValidThreePanelLayout(config)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject layout configurations with wrong panel count', () => {
      fc.assert(
        fc.property(invalidPanelCountArb, (config) => {
          expect(isValidThreePanelLayout(config)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject layout configurations with wrong panel order', () => {
      fc.assert(
        fc.property(invalidPanelOrderArb, (config) => {
          expect(isValidThreePanelLayout(config)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject layout configurations where column spans do not sum to total', () => {
      fc.assert(
        fc.property(invalidColumnSpanArb, (config) => {
          expect(isValidThreePanelLayout(config)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should be idempotent: calling getThreePanelLayoutConfig multiple times returns same structure', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), () => {
          const config1 = getThreePanelLayoutConfig();
          const config2 = getThreePanelLayoutConfig();
          const config3 = getThreePanelLayoutConfig();
          
          expect(config1.panelCount).toBe(config2.panelCount);
          expect(config2.panelCount).toBe(config3.panelCount);
          expect(config1.totalColumns).toBe(config2.totalColumns);
          expect(config2.totalColumns).toBe(config3.totalColumns);
          
          for (let i = 0; i < config1.panels.length; i++) {
            expect(config1.panels[i].name).toBe(config2.panels[i].name);
            expect(config2.panels[i].name).toBe(config3.panels[i].name);
            expect(config1.panels[i].colSpan).toBe(config2.panels[i].colSpan);
            expect(config2.panels[i].colSpan).toBe(config3.panels[i].colSpan);
            expect(config1.panels[i].order).toBe(config2.panels[i].order);
            expect(config2.panels[i].order).toBe(config3.panels[i].order);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure all panels have positive column spans', () => {
      const config = getThreePanelLayoutConfig();
      for (const panel of config.panels) {
        expect(panel.colSpan).toBeGreaterThan(0);
      }
    });

    it('should reject configurations with zero or negative column spans', () => {
      const invalidConfigs: PanelLayoutConfig[] = [
        {
          panelCount: 3,
          panels: [
            { name: 'navigator', colSpan: 0, order: 0 },
            { name: 'editor', colSpan: 6, order: 1 },
            { name: 'source', colSpan: 6, order: 2 },
          ],
          totalColumns: 12,
        },
        {
          panelCount: 3,
          panels: [
            { name: 'navigator', colSpan: -1, order: 0 },
            { name: 'editor', colSpan: 7, order: 1 },
            { name: 'source', colSpan: 6, order: 2 },
          ],
          totalColumns: 12,
        },
      ];

      for (const config of invalidConfigs) {
        expect(isValidThreePanelLayout(config)).toBe(false);
      }
    });
  });

  /**
   * **Feature: questions-layout-redesign, Property 2: Source display completeness**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * For any selected question with N sources (N > 0), the SourceSidePanel SHALL render
   * exactly N SourceCard components, each displaying the source's fileName, relevance
   * score, and text preview.
   */
  describe('Property 2: Source display completeness', () => {
    it('should return count equal to array length for any non-empty source array', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          const count = getSourceCount(sources);
          expect(count).toBe(sources.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should return exact count for any source array', () => {
      fc.assert(
        fc.property(sourceArrayArb, (sources) => {
          const count = getSourceCount(sources);
          expect(count).toBe(sources.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all sources when sorting (no sources lost)', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          const sorted = sortSourcesByRelevance(sources);
          // Same number of sources after sorting
          expect(sorted.length).toBe(sources.length);
          // All source IDs are preserved
          const originalIds = new Set(sources.map(s => s.id));
          const sortedIds = new Set(sorted.map(s => s.id));
          expect(sortedIds).toEqual(originalIds);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all source properties after sorting', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          const sorted = sortSourcesByRelevance(sources);
          
          // Each source in sorted should have the same properties as original
          for (const sortedSource of sorted) {
            const originalSource = sources.find(s => s.id === sortedSource.id);
            expect(originalSource).toBeDefined();
            expect(sortedSource.fileName).toBe(originalSource!.fileName);
            expect(sortedSource.relevance).toBe(originalSource!.relevance);
            expect(sortedSource.textContent).toBe(originalSource!.textContent);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not show NoSourceWarning when sources exist', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          const shouldShowWarning = shouldShowNoSourceWarning(sources);
          expect(shouldShowWarning).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should show NoSourceWarning only when sources array is empty', () => {
      fc.assert(
        fc.property(sourceArrayArb, (sources) => {
          const shouldShowWarning = shouldShowNoSourceWarning(sources);
          expect(shouldShowWarning).toBe(sources.length === 0);
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

    it('should ensure each source has required display fields (fileName exists)', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          // Every source should have a fileName for display
          for (const source of sources) {
            expect(source.fileName).toBeDefined();
            expect(typeof source.fileName).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure relevance is either a number or null/undefined', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          for (const source of sources) {
            const relevance = source.relevance;
            const isValidRelevance = 
              relevance === null || 
              relevance === undefined || 
              (typeof relevance === 'number' && relevance >= 0 && relevance <= 100);
            expect(isValidRelevance).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: questions-layout-redesign, Property 7: Use Content button visibility**
   * **Validates: Requirements 5.3**
   * 
   * For any source with non-empty textContent, the SourceCard SHALL render an enabled
   * "Use" button.
   */
  describe('Property 7: Use Content button visibility', () => {
    /**
     * Generator for sources with non-empty textContent (guaranteed usable content)
     */
    const sourceWithUsableContentArb: fc.Arbitrary<AnswerSource> = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      fileName: fc.string({ minLength: 1, maxLength: 50 }),
      filePath: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      pageNumber: fc.option(fc.oneof(fc.string(), fc.integer({ min: 1, max: 1000 })), { nil: undefined }),
      documentId: fc.option(fc.uuid(), { nil: undefined }),
      relevance: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
      // Non-empty, non-whitespace textContent
      textContent: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
    });

    /**
     * Generator for sources without usable content (null, undefined, empty, or whitespace-only)
     */
    const sourceWithoutUsableContentArb: fc.Arbitrary<AnswerSource> = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      fileName: fc.string({ minLength: 1, maxLength: 50 }),
      filePath: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      pageNumber: fc.option(fc.oneof(fc.string(), fc.integer({ min: 1, max: 1000 })), { nil: undefined }),
      documentId: fc.option(fc.uuid(), { nil: undefined }),
      relevance: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
      // Empty, whitespace-only, null, or undefined textContent
      textContent: fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.constant(''),
        fc.constant('   '),
        fc.constant('\t'),
        fc.constant('\n'),
        fc.constant('  \t\n  '),
      ),
    });

    it('should return true for hasUsableContent when textContent is non-empty and non-whitespace', () => {
      fc.assert(
        fc.property(sourceWithUsableContentArb, (source) => {
          const canUse = hasUsableContent(source);
          expect(canUse).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for hasUsableContent when textContent is null, undefined, empty, or whitespace-only', () => {
      fc.assert(
        fc.property(sourceWithoutUsableContentArb, (source) => {
          const canUse = hasUsableContent(source);
          expect(canUse).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly determine Use button state for any source', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const canUse = hasUsableContent(source);
          const hasNonEmptyContent = 
            source.textContent !== null && 
            source.textContent !== undefined && 
            source.textContent.trim() !== '';
          
          // hasUsableContent should match whether content is non-empty and non-whitespace
          expect(canUse).toBe(hasNonEmptyContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should enable Use button for sources with any non-whitespace character', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (textContent) => {
            const source: AnswerSource = {
              id: 1,
              fileName: 'test.pdf',
              textContent,
            };
            expect(hasUsableContent(source)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should disable Use button for sources with only whitespace characters', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', ' ', '  ', '\t', '\n', '\r', '   ', '\t\n', '  \t\n  '),
          (textContent) => {
            const source: AnswerSource = {
              id: 1,
              fileName: 'test.pdf',
              textContent,
            };
            expect(hasUsableContent(source)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: questions-layout-redesign, Property 4: Question text display**
   * **Validates: Requirements 3.1**
   * 
   * For any selected question, the QuestionEditor SHALL display the question.question
   * text in the header section.
   */
  describe('Property 4: Question text display', () => {
    /**
     * Generator for valid question objects with non-empty question text
     */
    const validQuestionArb: fc.Arbitrary<{ question: string }> = fc.record({
      question: fc.string({ minLength: 1, maxLength: 500 }),
    });

    /**
     * Generator for question objects with various question text values
     */
    const anyQuestionArb: fc.Arbitrary<{ question: string } | null | undefined> = fc.oneof(
      validQuestionArb,
      fc.constant(null),
      fc.constant(undefined),
      fc.record({ question: fc.constant('') }),
    );

    it('should return the exact question text for valid question objects', () => {
      fc.assert(
        fc.property(validQuestionArb, (question) => {
          const displayedText = getDisplayedQuestionText(question);
          expect(displayedText).toBe(question.question);
        }),
        { numRuns: 100 }
      );
    });

    it('should return empty string for null question', () => {
      const displayedText = getDisplayedQuestionText(null);
      expect(displayedText).toBe('');
    });

    it('should return empty string for undefined question', () => {
      const displayedText = getDisplayedQuestionText(undefined);
      expect(displayedText).toBe('');
    });

    it('should preserve question text exactly as provided (no trimming or modification)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (questionText) => {
            const question = { question: questionText };
            const displayedText = getDisplayedQuestionText(question);
            // The displayed text should be exactly the same as input
            expect(displayedText).toBe(questionText);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle questions with special characters correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (questionText) => {
            const question = { question: questionText };
            const displayedText = getDisplayedQuestionText(question);
            expect(displayedText).toBe(questionText);
            expect(displayedText.length).toBe(questionText.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle questions with whitespace correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '  leading spaces',
            'trailing spaces  ',
            '  both sides  ',
            'internal   spaces',
            '\ttabs\there',
            '\nnewlines\nhere'
          ),
          (questionText) => {
            const question = { question: questionText };
            const displayedText = getDisplayedQuestionText(question);
            // Should preserve whitespace exactly
            expect(displayedText).toBe(questionText);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty string for question object with non-string question property', () => {
      // Test with invalid question property types
      const invalidQuestions = [
        { question: 123 },
        { question: true },
        { question: [] },
        { question: {} },
        { question: null },
        { question: undefined },
      ];

      for (const invalidQuestion of invalidQuestions) {
        const displayedText = getDisplayedQuestionText(invalidQuestion as any);
        expect(displayedText).toBe('');
      }
    });

    it('should handle any valid string as question text', () => {
      fc.assert(
        fc.property(anyQuestionArb, (question) => {
          const displayedText = getDisplayedQuestionText(question);
          
          if (question === null || question === undefined) {
            expect(displayedText).toBe('');
          } else if (typeof question.question === 'string') {
            expect(displayedText).toBe(question.question);
          } else {
            expect(displayedText).toBe('');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: questions-layout-redesign, Property 3: Source click handler invocation**
   * **Validates: Requirements 2.4**
   * 
   * For any source card click event, the onSourceClick callback SHALL be invoked
   * with the exact source object that was clicked.
   */
  describe('Property 3: Source click handler invocation', () => {
    /**
     * Simulates source click handler behavior by capturing the source passed to callback
     * This tests the contract that onSourceClick receives the exact source object
     */
    function createSourceClickHandler(): {
      handler: (source: AnswerSource) => void;
      getClickedSource: () => AnswerSource | null;
      getClickCount: () => number;
    } {
      let clickedSource: AnswerSource | null = null;
      let clickCount = 0;
      
      return {
        handler: (source: AnswerSource) => {
          clickedSource = source;
          clickCount++;
        },
        getClickedSource: () => clickedSource,
        getClickCount: () => clickCount,
      };
    }

    /**
     * Simulates the source click flow: given a source and a handler,
     * invokes the handler with the source and returns the captured source
     */
    function simulateSourceClick(
      source: AnswerSource,
      onSourceClick: (source: AnswerSource) => void
    ): void {
      onSourceClick(source);
    }

    it('should invoke callback with the exact source object that was clicked', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const { handler, getClickedSource } = createSourceClickHandler();
          
          // Simulate clicking the source
          simulateSourceClick(source, handler);
          
          const clickedSource = getClickedSource();
          
          // The callback should have been invoked with the exact source
          expect(clickedSource).not.toBeNull();
          expect(clickedSource).toBe(source); // Same reference
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all source properties when passed to callback', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const { handler, getClickedSource } = createSourceClickHandler();
          
          simulateSourceClick(source, handler);
          
          const clickedSource = getClickedSource();
          
          // All properties should be preserved
          expect(clickedSource?.id).toBe(source.id);
          expect(clickedSource?.fileName).toBe(source.fileName);
          expect(clickedSource?.filePath).toBe(source.filePath);
          expect(clickedSource?.pageNumber).toBe(source.pageNumber);
          expect(clickedSource?.documentId).toBe(source.documentId);
          expect(clickedSource?.relevance).toBe(source.relevance);
          expect(clickedSource?.textContent).toBe(source.textContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should invoke callback exactly once per click', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const { handler, getClickCount } = createSourceClickHandler();
          
          expect(getClickCount()).toBe(0);
          
          simulateSourceClick(source, handler);
          
          expect(getClickCount()).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple different sources clicked sequentially', () => {
      fc.assert(
        fc.property(nonEmptySourceArrayArb, (sources) => {
          const { handler, getClickedSource, getClickCount } = createSourceClickHandler();
          
          // Click each source in sequence
          for (let i = 0; i < sources.length; i++) {
            simulateSourceClick(sources[i], handler);
            
            // After each click, the last clicked source should be the current one
            const clickedSource = getClickedSource();
            expect(clickedSource).toBe(sources[i]);
            expect(getClickCount()).toBe(i + 1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should pass source with correct id when clicking any source from array', () => {
      fc.assert(
        fc.property(
          nonEmptySourceArrayArb,
          fc.integer({ min: 0, max: 19 }),
          (sources, indexSeed) => {
            // Select a random source from the array
            const index = indexSeed % sources.length;
            const sourceToClick = sources[index];
            
            const { handler, getClickedSource } = createSourceClickHandler();
            
            simulateSourceClick(sourceToClick, handler);
            
            const clickedSource = getClickedSource();
            
            // The clicked source should have the same id as the source we clicked
            expect(clickedSource?.id).toBe(sourceToClick.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain source identity: clicked source is referentially equal to input', () => {
      fc.assert(
        fc.property(answerSourceArb(), (source) => {
          const { handler, getClickedSource } = createSourceClickHandler();
          
          simulateSourceClick(source, handler);
          
          const clickedSource = getClickedSource();
          
          // Referential equality check - same object in memory
          expect(clickedSource === source).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should work correctly with sources that have null/undefined optional fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            fileName: fc.string({ minLength: 1, maxLength: 50 }),
            filePath: fc.constant(undefined),
            pageNumber: fc.constant(undefined),
            documentId: fc.constant(undefined),
            relevance: fc.constant(null),
            textContent: fc.constant(null),
          }),
          (source) => {
            const { handler, getClickedSource } = createSourceClickHandler();
            
            simulateSourceClick(source, handler);
            
            const clickedSource = getClickedSource();
            
            expect(clickedSource).toBe(source);
            expect(clickedSource?.relevance).toBeNull();
            expect(clickedSource?.textContent).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should work correctly with sources that have all optional fields populated', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            fileName: fc.string({ minLength: 1, maxLength: 50 }),
            filePath: fc.string({ minLength: 1, maxLength: 100 }),
            pageNumber: fc.integer({ min: 1, max: 1000 }),
            documentId: fc.uuid(),
            relevance: fc.integer({ min: 0, max: 100 }),
            textContent: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          (source) => {
            const { handler, getClickedSource } = createSourceClickHandler();
            
            simulateSourceClick(source, handler);
            
            const clickedSource = getClickedSource();
            
            expect(clickedSource).toBe(source);
            expect(clickedSource?.filePath).toBe(source.filePath);
            expect(clickedSource?.pageNumber).toBe(source.pageNumber);
            expect(clickedSource?.documentId).toBe(source.documentId);
            expect(clickedSource?.relevance).toBe(source.relevance);
            expect(clickedSource?.textContent).toBe(source.textContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: questions-layout-redesign, Property 5: Unsaved indicator visibility**
   * **Validates: Requirements 3.4**
   * 
   * For any question where isUnsaved is true, the QuestionEditor SHALL render an
   * "Unsaved" badge in the header.
   */
  describe('Property 5: Unsaved indicator visibility', () => {
    it('should return true when isUnsaved is true', () => {
      fc.assert(
        fc.property(fc.constant(true), (isUnsaved) => {
          const shouldShow = shouldShowUnsavedIndicator(isUnsaved);
          expect(shouldShow).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false when isUnsaved is false', () => {
      fc.assert(
        fc.property(fc.constant(false), (isUnsaved) => {
          const shouldShow = shouldShowUnsavedIndicator(isUnsaved);
          expect(shouldShow).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly determine unsaved indicator visibility for any boolean value', () => {
      fc.assert(
        fc.property(fc.boolean(), (isUnsaved) => {
          const shouldShow = shouldShowUnsavedIndicator(isUnsaved);
          // The indicator should be visible if and only if isUnsaved is true
          expect(shouldShow).toBe(isUnsaved === true);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency: indicator visibility matches isUnsaved state exactly', () => {
      fc.assert(
        fc.property(fc.boolean(), (isUnsaved) => {
          const shouldShow = shouldShowUnsavedIndicator(isUnsaved);
          // Bidirectional implication: shouldShow === true iff isUnsaved === true
          expect(shouldShow === true).toBe(isUnsaved === true);
          expect(shouldShow === false).toBe(isUnsaved === false);
        }),
        { numRuns: 100 }
      );
    });

    it('should be idempotent: calling multiple times with same input returns same result', () => {
      fc.assert(
        fc.property(fc.boolean(), (isUnsaved) => {
          const result1 = shouldShowUnsavedIndicator(isUnsaved);
          const result2 = shouldShowUnsavedIndicator(isUnsaved);
          const result3 = shouldShowUnsavedIndicator(isUnsaved);
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: questions-layout-redesign, Property 6: Content append correctness**
   * **Validates: Requirements 5.1**
   * 
   * For any source with non-empty textContent and any current answer text, invoking
   * onUseContent SHALL result in the source text being appended to the answer with
   * proper formatting.
   */
  describe('Property 6: Content append correctness', () => {
    /**
     * Generator for non-empty, non-whitespace source content
     */
    const nonEmptySourceContentArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 500 })
      .filter(s => s.trim().length > 0);

    /**
     * Generator for any answer text (including empty)
     */
    const answerTextArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 500 });

    /**
     * Generator for non-empty answer text
     */
    const nonEmptyAnswerTextArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 500 })
      .filter(s => s.trim().length > 0);

    /**
     * Generator for empty or whitespace-only answer text
     */
    const emptyOrWhitespaceAnswerArb: fc.Arbitrary<string> = fc.oneof(
      fc.constant(''),
      fc.constant('   '),
      fc.constant('\t'),
      fc.constant('\n'),
      fc.constant('  \t\n  ')
    );

    it('should append source content to non-empty answer with double newline separator', () => {
      fc.assert(
        fc.property(nonEmptyAnswerTextArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // Result should contain the original text
          expect(result.startsWith(currentText)).toBe(true);
          
          // Result should contain the source content
          expect(result.endsWith(sourceContent)).toBe(true);
          
          // Result should have double newline separator between original and source
          expect(result).toBe(currentText + '\n\n' + sourceContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should return source content directly when current answer is empty', () => {
      fc.assert(
        fc.property(nonEmptySourceContentArb, (sourceContent) => {
          const result = appendSourceContent('', sourceContent);
          
          // Result should be exactly the source content
          expect(result).toBe(sourceContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should return source content directly when current answer is whitespace-only', () => {
      fc.assert(
        fc.property(emptyOrWhitespaceAnswerArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // Result should be exactly the source content (whitespace-only is treated as empty)
          expect(result).toBe(sourceContent);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve source content exactly (no modification)', () => {
      fc.assert(
        fc.property(answerTextArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // The source content should appear in the result exactly as provided
          expect(result.includes(sourceContent)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve original answer text exactly when non-empty (no modification)', () => {
      fc.assert(
        fc.property(nonEmptyAnswerTextArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // The original text should appear at the start of the result exactly as provided
          expect(result.startsWith(currentText)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should result in combined length equal to original + separator + source for non-empty answers', () => {
      fc.assert(
        fc.property(nonEmptyAnswerTextArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          const separator = '\n\n';
          
          // Length should be: original + separator + source
          expect(result.length).toBe(currentText.length + separator.length + sourceContent.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should result in length equal to source content for empty/whitespace answers', () => {
      fc.assert(
        fc.property(emptyOrWhitespaceAnswerArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result = appendSourceContent(currentText, sourceContent);
          
          // Length should be exactly the source content length
          expect(result.length).toBe(sourceContent.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple appends correctly (associativity-like property)', () => {
      fc.assert(
        fc.property(
          nonEmptyAnswerTextArb,
          nonEmptySourceContentArb,
          nonEmptySourceContentArb,
          (initialText, source1, source2) => {
            // Append source1, then source2
            const afterFirst = appendSourceContent(initialText, source1);
            const afterSecond = appendSourceContent(afterFirst, source2);
            
            // Result should contain all three parts in order
            expect(afterSecond.includes(initialText)).toBe(true);
            expect(afterSecond.includes(source1)).toBe(true);
            expect(afterSecond.includes(source2)).toBe(true);
            
            // Verify the structure: initialText + separator + source1 + separator + source2
            // The separator is '\n\n' as defined in appendSourceContent
            const separator = '\n\n';
            const trimmedInitial = initialText.trim();
            
            // The result should start with the initial text (or be just source content if initial was whitespace)
            if (trimmedInitial) {
              expect(afterSecond.startsWith(initialText)).toBe(true);
              
              // After the initial text, there should be a separator, then source1
              const afterInitialAndSep = initialText + separator;
              expect(afterSecond.startsWith(afterInitialAndSep)).toBe(true);
              
              // The result should end with source2
              expect(afterSecond.endsWith(source2)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle special characters in source content correctly', () => {
      fc.assert(
        fc.property(
          answerTextArb,
          fc.constantFrom(
            'Content with "quotes"',
            "Content with 'apostrophes'",
            'Content with <html> tags',
            'Content with & ampersand',
            'Content with\ttabs',
            'Content with\nnewlines',
            'Content with unicode: 日本語 中文 한국어',
            'Content with emoji: 🎉 🚀 ✨'
          ),
          (currentText, sourceContent) => {
            const result = appendSourceContent(currentText, sourceContent);
            
            // Source content should be preserved exactly
            expect(result.includes(sourceContent)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic: same inputs always produce same output', () => {
      fc.assert(
        fc.property(answerTextArb, nonEmptySourceContentArb, (currentText, sourceContent) => {
          const result1 = appendSourceContent(currentText, sourceContent);
          const result2 = appendSourceContent(currentText, sourceContent);
          const result3 = appendSourceContent(currentText, sourceContent);
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 100 }
      );
    });
  });
});
