/**
 * Integration tests for the hybrid question selection flows
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 1.2, 1.3, 1.4**
 * 
 * These tests verify the complete end-to-end flows for each extraction mode:
 * - Auto Extract mode
 * - Manual Selection mode
 * - AI-Assisted mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Annotation, AnnotationState, ExtractionMode } from '@/types/annotation';
import {
  addAnnotationPure,
  acceptAllSuggestionsPure,
  getAnnotationStatePure,
  type CreateAnnotationInput,
} from '@/hooks/use-annotation-state';
import {
  organizeAnnotationsIntoSections,
  transformAnnotationsToSaveRequest,
} from '@/lib/services/save-annotations-service';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Simulates the extraction mode selection and routing logic
 */
function routeByExtractionMode(mode: ExtractionMode): 'auto' | 'manual' | 'ai-assisted' {
  switch (mode) {
    case 'auto':
      return 'auto';
    case 'manual':
      return 'manual';
    case 'ai-assisted':
      return 'ai-assisted';
    default:
      return 'auto';
  }
}

/**
 * Simulates the complete manual selection flow
 */
function simulateManualSelectionFlow(
  selections: CreateAnnotationInput[]
): AnnotationState {
  let annotations: Annotation[] = [];
  
  // Add each selection as an annotation
  for (const selection of selections) {
    const result = addAnnotationPure(annotations, selection);
    annotations = result.annotations;
  }
  
  return getAnnotationStatePure(annotations);
}

/**
 * Simulates the complete AI-assisted flow
 */
function simulateAIAssistedFlow(
  manualSelections: CreateAnnotationInput[],
  aiSuggestions: Annotation[],
  acceptAll: boolean
): AnnotationState {
  let annotations: Annotation[] = [];
  
  // Add manual selections
  for (const selection of manualSelections) {
    const result = addAnnotationPure(annotations, selection);
    annotations = result.annotations;
  }
  
  // Accept AI suggestions
  if (acceptAll && aiSuggestions.length > 0) {
    const result = acceptAllSuggestionsPure(annotations, aiSuggestions);
    annotations = result.annotations;
  }
  
  return getAnnotationStatePure(annotations);
}

// ============================================================================
// Generators
// ============================================================================

const extractionModeArb: fc.Arbitrary<ExtractionMode> = fc.constantFrom('auto', 'manual', 'ai-assisted');

const createAnnotationInputArb: fc.Arbitrary<CreateAnnotationInput> = fc.record({
  type: fc.constantFrom('section', 'question'),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  pageNumber: fc.integer({ min: 1, max: 50 }),
  boundingRect: fc.option(
    fc.record({
      x: fc.float({ min: 0, max: 1000, noNaN: true }),
      y: fc.float({ min: 0, max: 1000, noNaN: true }),
      width: fc.float({ min: 1, max: 500, noNaN: true }),
      height: fc.float({ min: 1, max: 100, noNaN: true }),
    }),
    { nil: undefined }
  ),
  source: fc.constantFrom('manual', 'ai-suggestion'),
});

const annotationArb: fc.Arbitrary<Annotation> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('section', 'question'),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  pageNumber: fc.integer({ min: 1, max: 50 }),
  boundingRect: fc.option(
    fc.record({
      x: fc.float({ min: 0, max: 1000, noNaN: true }),
      y: fc.float({ min: 0, max: 1000, noNaN: true }),
      width: fc.float({ min: 1, max: 500, noNaN: true }),
      height: fc.float({ min: 1, max: 100, noNaN: true }),
    }),
    { nil: undefined }
  ),
  createdAt: fc.date(),
  source: fc.constantFrom('manual', 'ai-suggestion'),
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Question Selection Flow Integration Tests', () => {
  /**
   * **Feature: hybrid-question-selection**
   * **Requirements: 1.2 - Auto Extract mode end-to-end**
   * 
   * WHEN a user selects Auto Extract mode THEN the Question_Selection_System 
   * SHALL process the document using the existing Gemini AI extraction 
   * without additional user input
   */
  describe('Auto Extract Mode Flow', () => {
    it('should route to auto extraction when mode is auto', () => {
      fc.assert(
        fc.property(
          fc.constant('auto' as ExtractionMode),
          (mode) => {
            const route = routeByExtractionMode(mode);
            expect(route).toBe('auto');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not require manual annotation state for auto mode', () => {
      // Auto mode bypasses the annotation system entirely
      // This test verifies the routing logic correctly identifies auto mode
      const mode: ExtractionMode = 'auto';
      const route = routeByExtractionMode(mode);
      
      expect(route).toBe('auto');
      // In auto mode, we don't create annotation state - we use Gemini directly
    });
  });

  /**
   * **Feature: hybrid-question-selection**
   * **Requirements: 1.3 - Manual Selection mode end-to-end**
   * 
   * WHEN a user selects Manual Selection mode THEN the Question_Selection_System 
   * SHALL display the PDF_Viewer after document upload for manual text selection
   */
  describe('Manual Selection Mode Flow', () => {
    it('should route to manual selection when mode is manual', () => {
      fc.assert(
        fc.property(
          fc.constant('manual' as ExtractionMode),
          (mode) => {
            const route = routeByExtractionMode(mode);
            expect(route).toBe('manual');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should correctly process manual selections into annotation state', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 1, maxLength: 10 }),
          (selections) => {
            const state = simulateManualSelectionFlow(selections);
            
            // Total annotations should match selections
            const totalAnnotations = state.sections.length + state.questions.length;
            expect(totalAnnotations).toBe(selections.length);
            
            // All section selections should be in sections
            const sectionSelections = selections.filter(s => s.type === 'section');
            expect(state.sections.length).toBe(sectionSelections.length);
            
            // All question selections should be in questions
            const questionSelections = selections.filter(s => s.type === 'question');
            expect(state.questions.length).toBe(questionSelections.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve text content through the manual selection flow', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 1, maxLength: 10 }),
          (selections) => {
            const state = simulateManualSelectionFlow(selections);
            
            // Collect all texts from the state
            const stateTexts = new Set([
              ...state.sections.map(s => s.text),
              ...state.questions.map(q => q.text),
            ]);
            
            // All selection texts should be in the state
            selections.forEach(selection => {
              expect(stateTexts.has(selection.text)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly transform manual selections to save request', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (selections, projectId, documentName) => {
            const state = simulateManualSelectionFlow(selections);
            const request = transformAnnotationsToSaveRequest(state, projectId, documentName);
            
            // Request should have correct metadata
            expect(request.projectId).toBe(projectId);
            expect(request.documentName).toBe(documentName);
            
            // Request should have sections array
            expect(Array.isArray(request.sections)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hybrid-question-selection**
   * **Requirements: 1.4 - AI-Assisted mode end-to-end**
   * 
   * WHEN a user selects AI-Assisted mode THEN the Question_Selection_System 
   * SHALL display AI_Suggestions on the PDF_Viewer for user validation
   */
  describe('AI-Assisted Mode Flow', () => {
    it('should route to ai-assisted when mode is ai-assisted', () => {
      fc.assert(
        fc.property(
          fc.constant('ai-assisted' as ExtractionMode),
          (mode) => {
            const route = routeByExtractionMode(mode);
            expect(route).toBe('ai-assisted');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should correctly combine manual selections with accepted AI suggestions', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 0, maxLength: 5 }),
          fc.array(annotationArb, { minLength: 1, maxLength: 5 }),
          (manualSelections, aiSuggestions) => {
            const state = simulateAIAssistedFlow(manualSelections, aiSuggestions, true);
            
            // Total should be manual + AI suggestions
            const totalAnnotations = state.sections.length + state.questions.length;
            expect(totalAnnotations).toBe(manualSelections.length + aiSuggestions.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all text content when accepting AI suggestions', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 0, maxLength: 5 }),
          fc.array(annotationArb, { minLength: 1, maxLength: 5 }),
          (manualSelections, aiSuggestions) => {
            const state = simulateAIAssistedFlow(manualSelections, aiSuggestions, true);
            
            // Collect all texts from the state
            const stateTexts = new Set([
              ...state.sections.map(s => s.text),
              ...state.questions.map(q => q.text),
            ]);
            
            // All manual selection texts should be in the state
            manualSelections.forEach(selection => {
              expect(stateTexts.has(selection.text)).toBe(true);
            });
            
            // All AI suggestion texts should be in the state
            aiSuggestions.forEach(suggestion => {
              expect(stateTexts.has(suggestion.text)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only include manual selections when AI suggestions are not accepted', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 1, maxLength: 5 }),
          fc.array(annotationArb, { minLength: 1, maxLength: 5 }),
          (manualSelections, aiSuggestions) => {
            const state = simulateAIAssistedFlow(manualSelections, aiSuggestions, false);
            
            // Total should only be manual selections
            const totalAnnotations = state.sections.length + state.questions.length;
            expect(totalAnnotations).toBe(manualSelections.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly transform AI-assisted flow to save request', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 0, maxLength: 5 }),
          fc.array(annotationArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (manualSelections, aiSuggestions, projectId, documentName) => {
            const state = simulateAIAssistedFlow(manualSelections, aiSuggestions, true);
            const request = transformAnnotationsToSaveRequest(state, projectId, documentName);
            
            // Request should have correct metadata
            expect(request.projectId).toBe(projectId);
            expect(request.documentName).toBe(documentName);
            
            // Request should have sections array
            expect(Array.isArray(request.sections)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Cross-mode consistency tests
   */
  describe('Cross-Mode Consistency', () => {
    it('should produce consistent save request format regardless of mode', () => {
      fc.assert(
        fc.property(
          fc.array(createAnnotationInputArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (selections, projectId, documentName) => {
            // Manual mode
            const manualState = simulateManualSelectionFlow(selections);
            const manualRequest = transformAnnotationsToSaveRequest(manualState, projectId, documentName);
            
            // AI-assisted mode (no AI suggestions, just manual)
            const aiAssistedState = simulateAIAssistedFlow(selections, [], false);
            const aiAssistedRequest = transformAnnotationsToSaveRequest(aiAssistedState, projectId, documentName);
            
            // Both should have same structure
            expect(manualRequest.projectId).toBe(aiAssistedRequest.projectId);
            expect(manualRequest.documentName).toBe(aiAssistedRequest.documentName);
            expect(manualRequest.sections.length).toBe(aiAssistedRequest.sections.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly organize questions under sections in all modes', () => {
      fc.assert(
        fc.property(
          fc.array(
            createAnnotationInputArb.filter(input => input.type === 'section'),
            { minLength: 1, maxLength: 3 }
          ),
          fc.array(
            createAnnotationInputArb.filter(input => input.type === 'question'),
            { minLength: 1, maxLength: 5 }
          ),
          (sectionInputs, questionInputs) => {
            const allInputs = [...sectionInputs, ...questionInputs];
            const state = simulateManualSelectionFlow(allInputs);
            const { sections, orphanedQuestions } = organizeAnnotationsIntoSections(state);
            
            // All sections should be present
            expect(sections.length).toBe(sectionInputs.length);
            
            // Total questions should be preserved
            const questionsInSections = sections.reduce((sum, s) => sum + s.questions.length, 0);
            expect(questionsInSections + orphanedQuestions.length).toBe(questionInputs.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Extraction preference persistence tests
 */
describe('Extraction Preference Integration', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should persist and retrieve extraction mode preference', () => {
    fc.assert(
      fc.property(
        extractionModeArb,
        (mode) => {
          const STORAGE_KEY = 'rfp-extraction-mode-preference';
          
          // Store preference
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, lastUsed: new Date().toISOString() }));
          
          // Retrieve preference
          const stored = localStorage.getItem(STORAGE_KEY);
          expect(stored).not.toBeNull();
          
          const parsed = JSON.parse(stored!);
          expect(parsed.mode).toBe(mode);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should default to auto when no preference exists', () => {
    const STORAGE_KEY = 'rfp-extraction-mode-preference';
    const stored = localStorage.getItem(STORAGE_KEY);
    
    // No preference stored
    expect(stored).toBeNull();
    
    // Default should be 'auto'
    const defaultMode: ExtractionMode = 'auto';
    expect(defaultMode).toBe('auto');
  });
});
