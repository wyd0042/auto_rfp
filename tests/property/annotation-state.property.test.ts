/**
 * Property-based tests for annotation state management
 * 
 * **Feature: hybrid-question-selection**
 * 
 * These tests verify the correctness properties defined in the design document
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';
import type { Annotation, AnnotationType, AnnotationSource } from '@/types/annotation';
import {
  addAnnotationPure,
  removeAnnotationPure,
  acceptSuggestionPure,
  acceptAllSuggestionsPure,
  clearSuggestionsPure,
  getAnnotationStatePure,
  type CreateAnnotationInput,
} from '@/hooks/use-annotation-state';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid annotation types
 */
const annotationTypeArb: fc.Arbitrary<AnnotationType> = fc.constantFrom('section', 'question');

/**
 * Generator for valid annotation sources
 */
const annotationSourceArb: fc.Arbitrary<AnnotationSource> = fc.constantFrom('manual', 'ai-suggestion');

/**
 * Generator for bounding rectangles
 */
const boundingRectArb = fc.record({
  x: fc.float({ min: 0, max: 1000, noNaN: true }),
  y: fc.float({ min: 0, max: 1000, noNaN: true }),
  width: fc.float({ min: 1, max: 500, noNaN: true }),
  height: fc.float({ min: 1, max: 100, noNaN: true }),
});

/**
 * Generator for CreateAnnotationInput
 */
const createAnnotationInputArb: fc.Arbitrary<CreateAnnotationInput> = fc.record({
  type: annotationTypeArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  pageNumber: fc.integer({ min: 1, max: 100 }),
  boundingRect: fc.option(boundingRectArb, { nil: undefined }),
  source: annotationSourceArb,
});

/**
 * Generator for a complete Annotation object
 */
const annotationArb: fc.Arbitrary<Annotation> = fc.record({
  id: fc.uuid(),
  type: annotationTypeArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  pageNumber: fc.integer({ min: 1, max: 100 }),
  boundingRect: fc.option(boundingRectArb, { nil: undefined }),
  createdAt: fc.date(),
  source: annotationSourceArb,
});

/**
 * Generator for an array of annotations
 */
const annotationsArrayArb = fc.array(annotationArb, { minLength: 0, maxLength: 20 });

/**
 * Generator for an array of suggestions (annotations with ai-suggestion source)
 */
const suggestionsArrayArb = fc.array(
  annotationArb.map((a) => ({ ...a, source: 'ai-suggestion' as AnnotationSource })),
  { minLength: 0, maxLength: 20 }
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Annotation State Property Tests', () => {
  /**
   * **Feature: hybrid-question-selection, Property 1: Annotation Addition Preserves Type**
   * **Validates: Requirements 3.3, 3.4**
   * 
   * For any text selection and tag type (section or question), when the selection
   * is tagged, the resulting annotation in the Annotation_State SHALL have the
   * correct type and contain the selected text.
   */
  describe('Property 1: Annotation Addition Preserves Type', () => {
    it('should preserve type and text when adding an annotation', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          createAnnotationInputArb,
          (existingAnnotations, input) => {
            const { annotations, newAnnotation } = addAnnotationPure(existingAnnotations, input);

            // The new annotation should have the same type as input
            expect(newAnnotation.type).toBe(input.type);
            
            // The new annotation should have the same text as input
            expect(newAnnotation.text).toBe(input.text);
            
            // The new annotation should be in the resulting array
            expect(annotations).toContainEqual(newAnnotation);
            
            // The array length should increase by exactly 1
            expect(annotations.length).toBe(existingAnnotations.length + 1);
            
            // All existing annotations should still be present
            existingAnnotations.forEach((existing) => {
              expect(annotations).toContainEqual(existing);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate a unique ID for each new annotation', () => {
      fc.assert(
        fc.property(
          createAnnotationInputArb,
          createAnnotationInputArb,
          (input1, input2) => {
            const { newAnnotation: annotation1 } = addAnnotationPure([], input1);
            const { newAnnotation: annotation2 } = addAnnotationPure([], input2);

            // Each annotation should have a unique ID
            expect(annotation1.id).not.toBe(annotation2.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hybrid-question-selection, Property 3: Annotation Deletion Consistency**
   * **Validates: Requirements 4.2**
   * 
   * For any annotation in the Annotation_State, deleting it SHALL result in the
   * annotation being removed from the state, and the state length SHALL decrease
   * by exactly one.
   */
  describe('Property 3: Annotation Deletion Consistency', () => {
    it('should remove exactly one annotation and decrease length by one', () => {
      fc.assert(
        fc.property(
          fc.array(annotationArb, { minLength: 1, maxLength: 20 }),
          (annotations) => {
            // Pick a random annotation to delete
            const indexToDelete = Math.floor(Math.random() * annotations.length);
            const annotationToDelete = annotations[indexToDelete];

            const result = removeAnnotationPure(annotations, annotationToDelete.id);

            // Length should decrease by exactly 1
            expect(result.length).toBe(annotations.length - 1);

            // The deleted annotation should not be in the result
            expect(result.find((a) => a.id === annotationToDelete.id)).toBeUndefined();

            // All other annotations should still be present
            annotations
              .filter((a) => a.id !== annotationToDelete.id)
              .forEach((remaining) => {
                expect(result).toContainEqual(remaining);
              });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not change array when deleting non-existent ID', () => {
      fc.assert(
        fc.property(annotationsArrayArb, (annotations) => {
          const nonExistentId = uuidv4();
          const result = removeAnnotationPure(annotations, nonExistentId);

          // Length should remain the same
          expect(result.length).toBe(annotations.length);

          // All annotations should still be present
          annotations.forEach((annotation) => {
            expect(result).toContainEqual(annotation);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hybrid-question-selection, Property 4: Suggestion Acceptance Transfers State**
   * **Validates: Requirements 5.3**
   * 
   * For any AI suggestion, accepting it SHALL remove it from the suggestions list
   * and add it to the annotations list with the same text and type.
   */
  describe('Property 4: Suggestion Acceptance Transfers State', () => {
    it('should transfer suggestion to annotations with same text and type', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          fc.array(annotationArb, { minLength: 1, maxLength: 20 }),
          (annotations, suggestions) => {
            // Pick a random suggestion to accept
            const indexToAccept = Math.floor(Math.random() * suggestions.length);
            const suggestionToAccept = suggestions[indexToAccept];

            const result = acceptSuggestionPure(annotations, suggestions, suggestionToAccept.id);

            // Suggestion should be removed from suggestions
            expect(result.suggestions.find((s) => s.id === suggestionToAccept.id)).toBeUndefined();
            expect(result.suggestions.length).toBe(suggestions.length - 1);

            // An annotation with the same text and type should be added
            const addedAnnotation = result.annotations.find(
              (a) => a.text === suggestionToAccept.text && a.type === suggestionToAccept.type
            );
            expect(addedAnnotation).toBeDefined();
            expect(addedAnnotation?.text).toBe(suggestionToAccept.text);
            expect(addedAnnotation?.type).toBe(suggestionToAccept.type);

            // Annotations length should increase by 1
            expect(result.annotations.length).toBe(annotations.length + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not change state when accepting non-existent suggestion', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          suggestionsArrayArb,
          (annotations, suggestions) => {
            const nonExistentId = uuidv4();
            const result = acceptSuggestionPure(annotations, suggestions, nonExistentId);

            // Both arrays should remain unchanged
            expect(result.annotations.length).toBe(annotations.length);
            expect(result.suggestions.length).toBe(suggestions.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hybrid-question-selection, Property 5: Accept All Transfers All Suggestions**
   * **Validates: Requirements 5.4**
   * 
   * For any set of AI suggestions, accepting all SHALL result in an empty
   * suggestions list and all suggestions being added to annotations.
   */
  describe('Property 5: Accept All Transfers All Suggestions', () => {
    it('should transfer all suggestions to annotations and empty suggestions list', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          suggestionsArrayArb,
          (annotations, suggestions) => {
            const result = acceptAllSuggestionsPure(annotations, suggestions);

            // Suggestions should be empty
            expect(result.suggestions).toHaveLength(0);

            // Annotations should have all original annotations plus all suggestions
            expect(result.annotations.length).toBe(annotations.length + suggestions.length);

            // All original annotations should still be present
            annotations.forEach((annotation) => {
              expect(result.annotations).toContainEqual(annotation);
            });

            // All suggestions should now be in annotations (by text and type)
            suggestions.forEach((suggestion) => {
              const found = result.annotations.find(
                (a) => a.text === suggestion.text && a.type === suggestion.type
              );
              expect(found).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hybrid-question-selection, Property 6: Clear Suggestions Preserves Annotations**
   * **Validates: Requirements 5.5**
   * 
   * For any annotation state with both annotations and suggestions, clearing
   * suggestions SHALL remove all suggestions while leaving all annotations unchanged.
   */
  describe('Property 6: Clear Suggestions Preserves Annotations', () => {
    it('should clear all suggestions while preserving all annotations', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          suggestionsArrayArb,
          (annotations, suggestions) => {
            const result = clearSuggestionsPure(annotations, suggestions);

            // Suggestions should be empty
            expect(result.suggestions).toHaveLength(0);

            // Annotations should be exactly the same
            expect(result.annotations.length).toBe(annotations.length);
            annotations.forEach((annotation) => {
              expect(result.annotations).toContainEqual(annotation);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hybrid-question-selection, Property 2: Annotation State Completeness**
   * **Validates: Requirements 3.5, 4.1**
   * 
   * For any set of annotations in the Annotation_State, the sidebar SHALL display
   * exactly all annotations - no more, no less.
   * 
   * This property verifies that getAnnotationState correctly partitions annotations
   * into sections and questions, and that the total count matches the input.
   */
  describe('Property 2: Annotation State Completeness', () => {
    it('should return all annotations partitioned by type with no duplicates or missing items', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          (annotations) => {
            const state = getAnnotationStatePure(annotations);

            // Total count should match: sections + questions = all annotations
            expect(state.sections.length + state.questions.length).toBe(annotations.length);

            // All sections should have type 'section'
            state.sections.forEach((section) => {
              expect(section.type).toBe('section');
            });

            // All questions should have type 'question'
            state.questions.forEach((question) => {
              expect(question.type).toBe('question');
            });

            // Every annotation should appear in exactly one of the arrays
            annotations.forEach((annotation) => {
              const inSections = state.sections.some((s) => s.id === annotation.id);
              const inQuestions = state.questions.some((q) => q.id === annotation.id);
              
              // Annotation should be in exactly one array (XOR)
              expect(inSections !== inQuestions).toBe(true);
              
              // Verify it's in the correct array based on type
              if (annotation.type === 'section') {
                expect(inSections).toBe(true);
              } else {
                expect(inQuestions).toBe(true);
              }
            });

            // No extra items should exist in the state
            state.sections.forEach((section) => {
              expect(annotations.some((a) => a.id === section.id)).toBe(true);
            });
            state.questions.forEach((question) => {
              expect(annotations.some((a) => a.id === question.id)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all annotation properties when partitioning', () => {
      fc.assert(
        fc.property(
          annotationsArrayArb,
          (annotations) => {
            const state = getAnnotationStatePure(annotations);
            const allFromState = [...state.sections, ...state.questions];

            // Each annotation should be deeply equal to its counterpart in the state
            annotations.forEach((annotation) => {
              const found = allFromState.find((a) => a.id === annotation.id);
              expect(found).toBeDefined();
              expect(found).toEqual(annotation);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Save Organization Property Tests
// ============================================================================

import {
  organizeAnnotationsIntoSections,
  transformAnnotationsToSaveRequest,
  transformToRfpSections,
} from '@/lib/services/save-annotations-service';
import type { AnnotationState } from '@/types/annotation';

/**
 * Generator for annotation without ID (to be assigned unique IDs later)
 */
const annotationWithoutIdArb = fc.record({
  type: annotationTypeArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  pageNumber: fc.integer({ min: 1, max: 100 }),
  boundingRect: fc.option(boundingRectArb, { nil: undefined }),
  createdAt: fc.date(),
  source: annotationSourceArb,
});

/**
 * Generator for an AnnotationState with sections and questions
 * Ensures unique IDs across all annotations
 */
const annotationStateArb: fc.Arbitrary<AnnotationState> = fc
  .tuple(
    fc.array(annotationWithoutIdArb, { minLength: 0, maxLength: 10 }),
    fc.array(annotationWithoutIdArb, { minLength: 0, maxLength: 20 })
  )
  .map(([sectionsWithoutId, questionsWithoutId]) => {
    // Assign unique IDs to all annotations
    let idCounter = 0;
    const sections: Annotation[] = sectionsWithoutId.map((s) => ({
      ...s,
      id: `section-${idCounter++}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'section' as AnnotationType,
    }));
    const questions: Annotation[] = questionsWithoutId.map((q) => ({
      ...q,
      id: `question-${idCounter++}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'question' as AnnotationType,
    }));
    return { sections, questions };
  });

/**
 * Generator for an AnnotationState with at least one section
 * Ensures unique IDs across all annotations
 */
const annotationStateWithSectionsArb: fc.Arbitrary<AnnotationState> = fc
  .tuple(
    fc.array(annotationWithoutIdArb, { minLength: 1, maxLength: 10 }),
    fc.array(annotationWithoutIdArb, { minLength: 0, maxLength: 20 })
  )
  .map(([sectionsWithoutId, questionsWithoutId]) => {
    // Assign unique IDs to all annotations
    let idCounter = 0;
    const sections: Annotation[] = sectionsWithoutId.map((s) => ({
      ...s,
      id: `section-${idCounter++}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'section' as AnnotationType,
    }));
    const questions: Annotation[] = questionsWithoutId.map((q) => ({
      ...q,
      id: `question-${idCounter++}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'question' as AnnotationType,
    }));
    return { sections, questions };
  });

describe('Save Organization Property Tests', () => {
  /**
   * **Feature: hybrid-question-selection, Property 7: Save Organizes Questions Under Sections**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any annotation state with sections and questions, saving SHALL produce
   * a data structure where each question is associated with a section, and no
   * questions are orphaned (unless there are no sections).
   */
  describe('Property 7: Save Organizes Questions Under Sections', () => {
    it('should organize all questions under sections with no questions lost', () => {
      fc.assert(
        fc.property(
          annotationStateArb,
          (annotationState) => {
            const { sections, orphanedQuestions } = organizeAnnotationsIntoSections(annotationState);
            
            // Count total questions in organized sections
            const questionsInSections = sections.reduce(
              (sum, section) => sum + section.questions.length,
              0
            );
            
            // Total questions should equal original questions count
            const totalQuestions = questionsInSections + orphanedQuestions.length;
            expect(totalQuestions).toBe(annotationState.questions.length);
            
            // Number of organized sections should match input sections
            expect(sections.length).toBe(annotationState.sections.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all question text when organizing', () => {
      fc.assert(
        fc.property(
          annotationStateArb,
          (annotationState) => {
            const { sections, orphanedQuestions } = organizeAnnotationsIntoSections(annotationState);
            
            // Collect all question texts from organized structure
            const organizedQuestionTexts = new Set<string>();
            sections.forEach((section) => {
              section.questions.forEach((q) => {
                organizedQuestionTexts.add(q.text);
              });
            });
            orphanedQuestions.forEach((q) => {
              organizedQuestionTexts.add(q.text);
            });
            
            // All original question texts should be present
            annotationState.questions.forEach((q) => {
              expect(organizedQuestionTexts.has(q.text)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all section titles when organizing', () => {
      fc.assert(
        fc.property(
          annotationStateArb,
          (annotationState) => {
            const { sections } = organizeAnnotationsIntoSections(annotationState);
            
            // Collect all section titles from organized structure
            const organizedSectionTitles = new Set(sections.map((s) => s.title));
            
            // All original section texts should be present as titles
            annotationState.sections.forEach((s) => {
              expect(organizedSectionTitles.has(s.text)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have no orphaned questions when sections exist and questions come after sections', () => {
      fc.assert(
        fc.property(
          annotationStateWithSectionsArb,
          (annotationState) => {
            // Ensure all questions come after the first section (by page and time)
            const firstSection = annotationState.sections.reduce((earliest, section) => {
              if (section.pageNumber < earliest.pageNumber) return section;
              if (section.pageNumber === earliest.pageNumber && 
                  new Date(section.createdAt).getTime() < new Date(earliest.createdAt).getTime()) {
                return section;
              }
              return earliest;
            }, annotationState.sections[0]);
            
            // Modify questions to come after the first section
            const modifiedQuestions = annotationState.questions.map((q) => ({
              ...q,
              pageNumber: Math.max(q.pageNumber, firstSection.pageNumber),
              createdAt: new Date(Math.max(
                new Date(q.createdAt).getTime(),
                new Date(firstSection.createdAt).getTime() + 1
              )),
            }));
            
            const modifiedState: AnnotationState = {
              sections: annotationState.sections,
              questions: modifiedQuestions,
            };
            
            const { orphanedQuestions } = organizeAnnotationsIntoSections(modifiedState);
            
            // No questions should be orphaned when they all come after a section
            expect(orphanedQuestions.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transform to valid SaveAnnotationsRequest format', () => {
      fc.assert(
        fc.property(
          annotationStateArb,
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (annotationState, projectId, documentName) => {
            const request = transformAnnotationsToSaveRequest(
              annotationState,
              projectId,
              documentName
            );
            
            // Request should have correct projectId and documentName
            expect(request.projectId).toBe(projectId);
            expect(request.documentName).toBe(documentName);
            
            // Request should have sections array
            expect(Array.isArray(request.sections)).toBe(true);
            
            // Each section should have title and questions array
            request.sections.forEach((section) => {
              expect(typeof section.title).toBe('string');
              expect(Array.isArray(section.questions)).toBe(true);
              
              // Each question should have text
              section.questions.forEach((q) => {
                expect(typeof q.text).toBe('string');
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transform to valid RfpSection format for API', () => {
      fc.assert(
        fc.property(
          annotationStateArb,
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (annotationState, projectId, documentName) => {
            const request = transformAnnotationsToSaveRequest(
              annotationState,
              projectId,
              documentName
            );
            const rfpSections = transformToRfpSections(request);
            
            // Should have same number of sections
            expect(rfpSections.length).toBe(request.sections.length);
            
            // Each RfpSection should have required fields
            rfpSections.forEach((section, index) => {
              expect(typeof section.id).toBe('string');
              expect(section.id).toBe(`section_${index + 1}`);
              expect(typeof section.title).toBe('string');
              expect(Array.isArray(section.questions)).toBe(true);
              
              // Each question should have id and question text
              section.questions.forEach((q) => {
                expect(typeof q.id).toBe('string');
                expect(typeof q.question).toBe('string');
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
