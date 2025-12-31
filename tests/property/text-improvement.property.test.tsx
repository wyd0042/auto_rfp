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
import { useTextImprovement, type UndoState } from '@/hooks/use-text-improvement';
import { ImprovementToolbar, isTextEmpty, shouldDisableButtons } from '@/components/ui/improvement-toolbar';
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

  /**
   * **Feature: ai-response-improvement, Property 3: Error Preserves Original Text**
   * **Validates: Requirements 1.4, 2.4, 3.4, 4.4**
   *
   * For any failed improvement action, the answer state SHALL remain unchanged
   * from the original text.
   */
  describe('Property 3: Error Preserves Original Text', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should not update undo state when improvement fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          improvementActionArb,
          fc.string({ minLength: 1, maxLength: 100 }), // error message
          async (originalText, action, errorMessage) => {
            // Mock failed API response
            global.fetch = vi.fn().mockResolvedValue({
              ok: false,
              status: 500,
              json: () => Promise.resolve({ error: errorMessage }),
            });

            const { result } = renderHook(() => useTextImprovement());

            // Initially, canUndo should be false
            expect(result.current.canUndo).toBe(false);

            // Attempt improvement (should fail)
            await act(async () => {
              try {
                await result.current.improve(originalText, action);
              } catch {
                // Expected to throw
              }
            });

            // After failed improvement, canUndo should still be false
            // (original text is preserved by not updating undo state)
            expect(result.current.canUndo).toBe(false);

            // Error should be set
            expect(result.current.error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error and set error state on API failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          improvementActionArb,
          async (originalText, action) => {
            // Mock network error
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useTextImprovement());

            // Attempt improvement (should fail)
            let thrownError: Error | null = null;
            await act(async () => {
              try {
                await result.current.improve(originalText, action);
              } catch (err) {
                thrownError = err as Error;
              }
            });

            // Should have thrown an error
            expect(thrownError).not.toBeNull();

            // Error state should be set
            expect(result.current.error).toBeTruthy();

            // Loading should be false after error
            expect(result.current.isLoading).toBe(false);

            // canUndo should still be false (no successful improvement)
            expect(result.current.canUndo).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve previous undo state when subsequent improvement fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          validTextArb,
          improvedTextArb,
          improvementActionArb,
          improvementActionArb,
          async (text1, text2, improved1, action1, action2) => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First call succeeds
                return Promise.resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      improvedText: improved1,
                      action: action1,
                      originalLength: text1.length,
                      improvedLength: improved1.length,
                    }),
                });
              } else {
                // Second call fails
                return Promise.resolve({
                  ok: false,
                  status: 500,
                  json: () => Promise.resolve({ error: 'API Error' }),
                });
              }
            });

            const { result } = renderHook(() => useTextImprovement());

            // First improvement succeeds
            await act(async () => {
              await result.current.improve(text1, action1);
            });

            expect(result.current.canUndo).toBe(true);

            // Second improvement fails
            await act(async () => {
              try {
                await result.current.improve(text2, action2);
              } catch {
                // Expected to throw
              }
            });

            // canUndo should still be true (previous undo state preserved)
            expect(result.current.canUndo).toBe(true);

            // Undo should restore text1 (from successful improvement)
            let restoredText: string | null = null;
            act(() => {
              restoredText = result.current.undo();
            });

            expect(restoredText).toBe(text1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property tests for ImprovementToolbar component
 *
 * **Feature: ai-response-improvement**
 */
describe('ImprovementToolbar Property Tests', () => {
  /**
   * Helper to render ImprovementToolbar with TooltipProvider
   */
  const renderToolbar = (props: {
    text: string;
    onImprove?: (text: string) => void;
    disabled?: boolean;
  }) => {
    return render(
      <TooltipProvider>
        <ImprovementToolbar
          text={props.text}
          onImprove={props.onImprove || vi.fn()}
          disabled={props.disabled}
        />
      </TooltipProvider>
    );
  };

  /**
   * **Feature: ai-response-improvement, Property 4: Empty Text Disables Actions**
   * **Validates: Requirements 5.2**
   *
   * For any empty or whitespace-only text, all improvement action buttons
   * SHALL be disabled.
   */
  describe('Property 4: Empty Text Disables Actions', () => {
    it('should disable all action buttons when text is empty or whitespace-only', () => {
      fc.assert(
        fc.property(emptyOrWhitespaceTextArb, (emptyText) => {
          const { unmount, container } = renderToolbar({ text: emptyText });

          // All four action buttons should be disabled - use container-scoped queries
          const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
          const professionalBtn = container.querySelector('[data-testid="improve-make_professional"]') as HTMLButtonElement;
          const conciseBtn = container.querySelector('[data-testid="improve-make_concise"]') as HTMLButtonElement;
          const bulletsBtn = container.querySelector('[data-testid="improve-convert_to_bullets"]') as HTMLButtonElement;

          expect(proofreadBtn.disabled).toBe(true);
          expect(professionalBtn.disabled).toBe(true);
          expect(conciseBtn.disabled).toBe(true);
          expect(bulletsBtn.disabled).toBe(true);

          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('should enable action buttons when text has non-whitespace content', () => {
      fc.assert(
        fc.property(validTextArb, (validText) => {
          const { unmount, container } = renderToolbar({ text: validText });

          // All four action buttons should be enabled - use container-scoped queries
          const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
          const professionalBtn = container.querySelector('[data-testid="improve-make_professional"]') as HTMLButtonElement;
          const conciseBtn = container.querySelector('[data-testid="improve-make_concise"]') as HTMLButtonElement;
          const bulletsBtn = container.querySelector('[data-testid="improve-convert_to_bullets"]') as HTMLButtonElement;

          expect(proofreadBtn.disabled).toBe(false);
          expect(professionalBtn.disabled).toBe(false);
          expect(conciseBtn.disabled).toBe(false);
          expect(bulletsBtn.disabled).toBe(false);

          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('should disable buttons when disabled prop is true regardless of text', () => {
      fc.assert(
        fc.property(validTextArb, (validText) => {
          const { unmount, container } = renderToolbar({ text: validText, disabled: true });

          // All four action buttons should be disabled even with valid text - use container-scoped queries
          const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
          const professionalBtn = container.querySelector('[data-testid="improve-make_professional"]') as HTMLButtonElement;
          const conciseBtn = container.querySelector('[data-testid="improve-make_concise"]') as HTMLButtonElement;
          const bulletsBtn = container.querySelector('[data-testid="improve-convert_to_bullets"]') as HTMLButtonElement;

          expect(proofreadBtn.disabled).toBe(true);
          expect(professionalBtn.disabled).toBe(true);
          expect(conciseBtn.disabled).toBe(true);
          expect(bulletsBtn.disabled).toBe(true);

          unmount();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-response-improvement, Property 5: Loading State Disables Actions**
   * **Validates: Requirements 1.3, 5.3**
   *
   * For any improvement action in progress (loading state true), all improvement
   * action buttons SHALL be disabled.
   */
  describe('Property 5: Loading State Disables Actions', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should disable all buttons during loading state', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          improvementActionArb,
          async (text, action) => {
            // Create a promise that we can control to keep the request pending
            let resolveRequest: (value: unknown) => void;
            const pendingPromise = new Promise((resolve) => {
              resolveRequest = resolve;
            });

            global.fetch = vi.fn().mockReturnValue(pendingPromise);

            const onImprove = vi.fn();
            const { unmount, container } = renderToolbar({ text, onImprove });

            // Click an action button to start loading - use container-scoped query
            const actionBtn = container.querySelector(`[data-testid="improve-${action}"]`) as HTMLButtonElement;
            expect(actionBtn).not.toBeNull();
            await act(async () => {
              actionBtn.click();
            });

            // During loading, all buttons should be disabled - use container-scoped queries
            // Note: We need to wait a tick for the state to update
            await waitFor(() => {
              const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
              const professionalBtn = container.querySelector('[data-testid="improve-make_professional"]') as HTMLButtonElement;
              const conciseBtn = container.querySelector('[data-testid="improve-make_concise"]') as HTMLButtonElement;
              const bulletsBtn = container.querySelector('[data-testid="improve-convert_to_bullets"]') as HTMLButtonElement;

              expect(proofreadBtn.disabled).toBe(true);
              expect(professionalBtn.disabled).toBe(true);
              expect(conciseBtn.disabled).toBe(true);
              expect(bulletsBtn.disabled).toBe(true);
            });

            // Resolve the pending request to clean up
            resolveRequest!({
              ok: true,
              json: () =>
                Promise.resolve({
                  improvedText: 'improved',
                  action,
                  originalLength: text.length,
                  improvedLength: 8,
                }),
            });

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should re-enable buttons after loading completes successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          improvedTextArb,
          improvementActionArb,
          async (text, improvedText, action) => {
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              json: () =>
                Promise.resolve({
                  improvedText,
                  action,
                  originalLength: text.length,
                  improvedLength: improvedText.length,
                }),
            });

            const onImprove = vi.fn();
            const { unmount, container } = renderToolbar({ text, onImprove });

            // Click an action button - use container-scoped query
            const actionBtn = container.querySelector(`[data-testid="improve-${action}"]`) as HTMLButtonElement;
            expect(actionBtn).not.toBeNull();
            await act(async () => {
              actionBtn.click();
            });

            // Wait for loading to complete
            await waitFor(() => {
              expect(onImprove).toHaveBeenCalledWith(improvedText);
            });

            // After loading completes, buttons should be enabled again - use container-scoped queries
            await waitFor(() => {
              const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
              const professionalBtn = container.querySelector('[data-testid="improve-make_professional"]') as HTMLButtonElement;
              const conciseBtn = container.querySelector('[data-testid="improve-make_concise"]') as HTMLButtonElement;
              const bulletsBtn = container.querySelector('[data-testid="improve-convert_to_bullets"]') as HTMLButtonElement;

              expect(proofreadBtn.disabled).toBe(false);
              expect(professionalBtn.disabled).toBe(false);
              expect(conciseBtn.disabled).toBe(false);
              expect(bulletsBtn.disabled).toBe(false);
            });

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should re-enable buttons after loading fails', async () => {
      await fc.assert(
        fc.asyncProperty(validTextArb, improvementActionArb, async (text, action) => {
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'API Error' }),
          });

          const onImprove = vi.fn();
          const { unmount, container } = renderToolbar({ text, onImprove });

          // Click an action button - use container-scoped query
          const actionBtn = container.querySelector(`[data-testid="improve-${action}"]`) as HTMLButtonElement;
          expect(actionBtn).not.toBeNull();
          await act(async () => {
            actionBtn.click();
          });

          // Wait for loading to complete (with error) - use container-scoped query
          await waitFor(() => {
            const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
            expect(proofreadBtn.disabled).toBe(false);
          });

          // After loading fails, buttons should be enabled again - use container-scoped queries
          const proofreadBtn = container.querySelector('[data-testid="improve-proofread"]') as HTMLButtonElement;
          const professionalBtn = container.querySelector('[data-testid="improve-make_professional"]') as HTMLButtonElement;
          const conciseBtn = container.querySelector('[data-testid="improve-make_concise"]') as HTMLButtonElement;
          const bulletsBtn = container.querySelector('[data-testid="improve-convert_to_bullets"]') as HTMLButtonElement;

          expect(proofreadBtn.disabled).toBe(false);
          expect(professionalBtn.disabled).toBe(false);
          expect(conciseBtn.disabled).toBe(false);
          expect(bulletsBtn.disabled).toBe(false);

          // onImprove should not have been called
          expect(onImprove).not.toHaveBeenCalled();

          unmount();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ai-response-improvement, Property 2: Successful Response Updates Answer**
   * **Validates: Requirements 1.2, 2.2, 3.2, 4.2**
   *
   * For any successful API response with improved text, the answer state SHALL be
   * updated to contain the improved text.
   */
  describe('Property 2: Successful Response Updates Answer', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call onImprove with improved text for any successful improvement action', async () => {
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

            const onImprove = vi.fn();
            const { unmount, container } = renderToolbar({ text: originalText, onImprove });

            // Use container-scoped query to avoid multiple element issues
            const actionBtn = container.querySelector(`[data-testid="improve-${action}"]`) as HTMLButtonElement;
            expect(actionBtn).not.toBeNull();
            
            await act(async () => {
              actionBtn.click();
            });

            // Wait for the improvement to complete
            await waitFor(() => {
              expect(onImprove).toHaveBeenCalled();
            });

            // onImprove should be called with the improved text
            expect(onImprove).toHaveBeenCalledWith(improvedText);
            expect(onImprove).toHaveBeenCalledTimes(1);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should call onImprove with exact improved text from API response', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTextArb,
          improvedTextArb,
          improvementActionArb,
          async (originalText, improvedText, action) => {
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

            const onImprove = vi.fn();
            const { unmount, container } = renderToolbar({ text: originalText, onImprove });

            const actionBtn = container.querySelector(`[data-testid="improve-${action}"]`) as HTMLButtonElement;
            expect(actionBtn).not.toBeNull();
            
            await act(async () => {
              actionBtn.click();
            });

            await waitFor(() => {
              expect(onImprove).toHaveBeenCalled();
            });

            // Verify the exact improved text is passed
            const calledWith = onImprove.mock.calls[0][0];
            expect(calledWith).toBe(improvedText);
            expect(calledWith).toStrictEqual(improvedText);

            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
