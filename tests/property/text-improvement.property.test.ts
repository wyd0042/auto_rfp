/**
 * Property-based tests for text improvement service
 *
 * **Feature: ai-response-improvement**
 *
 * These tests verify the correctness properties for the text improvement
 * service using fast-check for property-based testing.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, waitFor, render, screen } from '@testing-library/react';
import React from 'react';
// Import only the static configuration, not the service class
// to avoid requiring API key during tests
import {
  ACTION_PROMPTS,
  IMPROVEMENT_ACTIONS,
  type ImprovementAction,
} from '@/lib/services/text-improvement-service';
import { useTextImprovement } from '@/hooks/use-text-improvement';
import {
  isTextEmpty,
  shouldDisableButtons,
  ImprovementToolbar,
} from '@/components/ui/improvement-toolbar';
import { TooltipProvider } from '@/components/ui/tooltip';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid improvement action types
 */
const improvementActionArb: fc.Arbitrary<ImprovementAction> = fc.constantFrom(
  'proofread',
  'make_professional',
  'make_concise',
  'convert_to_bullets'
);

/**
 * Generator for pairs of different improvement actions
 */
const differentActionPairArb: fc.Arbitrary<[ImprovementAction, ImprovementAction]> = fc
  .tuple(improvementActionArb, improvementActionArb)
  .filter(([a, b]) => a !== b);

/**
 * Generator for non-empty text strings (valid for improvement)
 * Text must be at least 10 characters per API validation
 */
const validTextArb: fc.Arbitrary<string> = fc
  .string({ minLength: 10, maxLength: 500 })
  .filter((s) => s.trim().length >= 10);


/**
 * Generator for improved text (simulated API response)
 */
const improvedTextArb: fc.Arbitrary<string> = fc
  .string({ minLength: 10, maxLength: 500 })
  .filter((s) => s.trim().length >= 10);

/**
 * Generator for empty or whitespace-only strings
 * These should disable all improvement actions
 */
const emptyOrWhitespaceTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t\t'),
  fc.constant('\n\n'),
  fc.constant('  \t\n  ')
);

/**
 * Generator for null or undefined values
 */
const nullOrUndefinedArb: fc.Arbitrary<null | undefined> = fc.constantFrom(null, undefined);

// ============================================================================
// Property Tests
// ============================================================================

describe('Text Improvement Property Tests', () => {
  /**
   * **Feature: ai-response-improvement, Property 7: Action-Specific Prompts**
   * **Validates: Requirements 7.3**
   *
   * For any improvement action type, the service SHALL use a distinct prompt
   * template corresponding to that action type.
   */
  describe('Property 7: Action-Specific Prompts', () => {
    it('should have a distinct prompt for each action type', () => {
      fc.assert(
        fc.property(improvementActionArb, (action) => {
          const prompt = ACTION_PROMPTS[action];

          // Prompt should exist and be non-empty
          expect(prompt).toBeDefined();
          expect(typeof prompt).toBe('string');
          expect(prompt.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have different prompts for different actions', () => {
      fc.assert(
        fc.property(differentActionPairArb, ([action1, action2]) => {
          const prompt1 = ACTION_PROMPTS[action1];
          const prompt2 = ACTION_PROMPTS[action2];

          // Different actions should have different prompts
          expect(prompt1).not.toBe(prompt2);
        }),
        { numRuns: 100 }
      );
    });

    it('should have prompts that contain action-relevant keywords', () => {
      // Each action should have a prompt containing keywords relevant to that action
      const actionKeywords: Record<ImprovementAction, string[]> = {
        proofread: ['grammar', 'spelling', 'punctuation'],
        make_professional: ['professional', 'formal', 'business'],
        make_concise: ['concise', 'reduce', 'length'],
        convert_to_bullets: ['bullet', 'point', 'list'],
      };

      fc.assert(
        fc.property(improvementActionArb, (action) => {
          const prompt = ACTION_PROMPTS[action].toLowerCase();
          const keywords = actionKeywords[action];

          // At least one keyword should be present in the prompt
          const hasRelevantKeyword = keywords.some((keyword) =>
            prompt.includes(keyword.toLowerCase())
          );
          expect(hasRelevantKeyword).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have all four action types defined', () => {
      const expectedActions: ImprovementAction[] = [
        'proofread',
        'make_professional',
        'make_concise',
        'convert_to_bullets',
      ];

      for (const action of expectedActions) {
        expect(ACTION_PROMPTS[action]).toBeDefined();
        expect(IMPROVEMENT_ACTIONS[action]).toBeDefined();
      }
    });

    it('should have matching action IDs in IMPROVEMENT_ACTIONS config', () => {
      fc.assert(
        fc.property(improvementActionArb, (action) => {
          const config = IMPROVEMENT_ACTIONS[action];

          // Config should exist and have matching id
          expect(config).toBeDefined();
          expect(config.id).toBe(action);

          // Config should have required fields
          expect(config.label).toBeDefined();
          expect(typeof config.label).toBe('string');
          expect(config.icon).toBeDefined();
          expect(typeof config.icon).toBe('string');
          expect(config.description).toBeDefined();
          expect(typeof config.description).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('should have prompts that instruct to return only improved text', () => {
      fc.assert(
        fc.property(improvementActionArb, (action) => {
          const prompt = ACTION_PROMPTS[action].toLowerCase();

          // Each prompt should instruct to return only the result, no explanations
          const hasReturnOnlyInstruction =
            prompt.includes('return only') || prompt.includes('no explanation');
          expect(hasReturnOnlyInstruction).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: ai-response-improvement, Property 6: Undo Round-Trip**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   *
   * For any successful improvement action, storing the original text and then
   * calling undo SHALL restore the exact original text.
   */
  describe('Property 6: Undo Round-Trip', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should restore exact original text after successful improvement and undo', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          improvedTextArb,
          improvementActionArb,
          async (originalText, improvedText, action) => {
            // Mock successful API response
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              json: () =>
                Promise.resolve({
                  improvedText,
                  action,
                  originalLength: originalText.length,
                  improvedLength: improvedText.length,
                }),
            });

            const { result } = renderHook(() => useTextImprovement());

            // Initially, canUndo should be false
            expect(result.current.canUndo).toBe(false);

            // Perform improvement
            let returnedImprovedText: string = '';
            await act(async () => {
              returnedImprovedText = await result.current.improve(originalText, action);
            });

            // After improvement, canUndo should be true
            expect(result.current.canUndo).toBe(true);
            expect(returnedImprovedText).toBe(improvedText);

            // Perform undo
            let restoredText: string | null = null;
            act(() => {
              restoredText = result.current.undo();
            });

            // Undo should restore exact original text
            expect(restoredText).toBe(originalText);

            // After undo, canUndo should be false
            expect(result.current.canUndo).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when undo is called without prior improvement', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { result } = renderHook(() => useTextImprovement());

          // Initially, canUndo should be false
          expect(result.current.canUndo).toBe(false);

          // Undo without prior improvement should return null
          let restoredText: string | null = 'not-null';
          act(() => {
            restoredText = result.current.undo();
          });

          expect(restoredText).toBeNull();
          expect(result.current.canUndo).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should update undo state when new improvement is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          validTextArb,
          improvedTextArb,
          improvedTextArb,
          improvementActionArb,
          improvementActionArb,
          async (text1, text2, improved1, improved2, action1, action2) => {
            // Mock successful API responses
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
              callCount++;
              const improvedText = callCount === 1 ? improved1 : improved2;
              return Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    improvedText,
                    action: callCount === 1 ? action1 : action2,
                    originalLength: (callCount === 1 ? text1 : text2).length,
                    improvedLength: improvedText.length,
                  }),
              });
            });

            const { result } = renderHook(() => useTextImprovement());

            // First improvement
            await act(async () => {
              await result.current.improve(text1, action1);
            });

            // Second improvement (should update undo state to text2)
            await act(async () => {
              await result.current.improve(text2, action2);
            });

            // Undo should restore text2 (the most recent original), not text1
            let restoredText: string | null = null;
            act(() => {
              restoredText = result.current.undo();
            });

            // **Requirements: 6.4** - new improvement updates stored original text
            expect(restoredText).toBe(text2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-response-improvement, Property 4: Empty Text Disables Actions**
   * **Validates: Requirements 5.2**
   *
   * For any empty or whitespace-only text, all improvement action buttons
   * SHALL be disabled.
   */
  describe('Property 4: Empty Text Disables Actions', () => {
    it('should return true for empty string', () => {
      fc.assert(
        fc.property(fc.constant(''), (text) => {
          expect(isTextEmpty(text)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for whitespace-only strings', () => {
      fc.assert(
        fc.property(emptyOrWhitespaceTextArb, (text) => {
          expect(isTextEmpty(text)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for null or undefined', () => {
      fc.assert(
        fc.property(nullOrUndefinedArb, (text) => {
          expect(isTextEmpty(text)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for non-empty text', () => {
      fc.assert(
        fc.property(validTextArb, (text) => {
          expect(isTextEmpty(text)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should disable buttons when text is empty or whitespace', () => {
      fc.assert(
        fc.property(
          emptyOrWhitespaceTextArb,
          fc.boolean(),
          fc.boolean(),
          (text, isLoading, disabled) => {
            // When text is empty, buttons should always be disabled
            // regardless of loading or disabled state
            expect(shouldDisableButtons(text, isLoading, disabled)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should disable buttons when text is null or undefined', () => {
      fc.assert(
        fc.property(
          nullOrUndefinedArb,
          fc.boolean(),
          fc.boolean(),
          (text, isLoading, disabled) => {
            // When text is null/undefined, buttons should always be disabled
            expect(shouldDisableButtons(text, isLoading, disabled)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-response-improvement, Property 5: Loading State Disables Actions**
   * **Validates: Requirements 1.3, 5.3**
   *
   * For any improvement action in progress (loading state true),
   * all improvement action buttons SHALL be disabled.
   */
  describe('Property 5: Loading State Disables Actions', () => {
    it('should disable buttons when loading is true regardless of text content', () => {
      fc.assert(
        fc.property(
          validTextArb,
          fc.boolean(),
          (text, disabled) => {
            // When loading is true, buttons should be disabled
            // even if text is valid and disabled prop is false
            expect(shouldDisableButtons(text, true, disabled)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not disable buttons when loading is false and text is valid and not externally disabled', () => {
      fc.assert(
        fc.property(validTextArb, (text) => {
          // When loading is false, text is valid, and not externally disabled
          // buttons should NOT be disabled
          expect(shouldDisableButtons(text, false, false)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should disable buttons when externally disabled regardless of loading state', () => {
      fc.assert(
        fc.property(
          validTextArb,
          fc.boolean(),
          (text, isLoading) => {
            // When disabled prop is true, buttons should be disabled
            // regardless of loading state
            expect(shouldDisableButtons(text, isLoading, true)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly combine all disable conditions', () => {
      fc.assert(
        fc.property(
          fc.oneof(validTextArb, emptyOrWhitespaceTextArb, nullOrUndefinedArb),
          fc.boolean(),
          fc.boolean(),
          (text, isLoading, disabled) => {
            const result = shouldDisableButtons(text, isLoading, disabled);
            
            // Buttons should be disabled if ANY of these conditions is true:
            // 1. Text is empty/whitespace/null/undefined
            // 2. Loading is true
            // 3. Disabled prop is true
            const textIsEmpty = !text || text.trim().length === 0;
            const expectedDisabled = textIsEmpty || isLoading || disabled;
            
            expect(result).toBe(expectedDisabled);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
