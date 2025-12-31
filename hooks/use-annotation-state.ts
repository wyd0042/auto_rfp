import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Annotation, AnnotationState, AnnotationType, AnnotationSource } from '@/types/annotation';

/**
 * Input for creating a new annotation (without id, which is auto-generated)
 */
export interface CreateAnnotationInput {
  type: AnnotationType;
  text: string;
  pageNumber: number;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  source: AnnotationSource;
}

/**
 * Return type for the useAnnotationState hook
 */
export interface UseAnnotationStateReturn {
  annotations: Annotation[];
  suggestions: Annotation[];
  addAnnotation: (input: CreateAnnotationInput) => Annotation;
  removeAnnotation: (id: string) => void;
  setSuggestions: (suggestions: Annotation[]) => void;
  acceptSuggestion: (id: string) => void;
  acceptAllSuggestions: () => void;
  clearSuggestions: () => void;
  getAnnotationState: () => AnnotationState;
}

/**
 * Custom hook for managing annotation state in the PDF annotator.
 * Handles both user-created annotations and AI suggestions.
 * 
 * **Feature: hybrid-question-selection**
 * 
 * @returns Object containing annotation state and management functions
 */
export function useAnnotationState(): UseAnnotationStateReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [suggestions, setSuggestionsState] = useState<Annotation[]>([]);

  /**
   * Adds a new annotation to the state.
   * Generates a unique ID and timestamp for the annotation.
   * 
   * @param input - The annotation data without id
   * @returns The created annotation with generated id
   */
  const addAnnotation = useCallback((input: CreateAnnotationInput): Annotation => {
    const newAnnotation: Annotation = {
      id: uuidv4(),
      type: input.type,
      text: input.text,
      pageNumber: input.pageNumber,
      boundingRect: input.boundingRect,
      createdAt: new Date(),
      source: input.source,
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    return newAnnotation;
  }, []);

  /**
   * Removes an annotation from the state by its ID.
   * 
   * @param id - The ID of the annotation to remove
   */
  const removeAnnotation = useCallback((id: string): void => {
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== id));
  }, []);

  /**
   * Sets the AI suggestions list.
   * Replaces any existing suggestions.
   * 
   * @param newSuggestions - Array of suggested annotations
   */
  const setSuggestions = useCallback((newSuggestions: Annotation[]): void => {
    setSuggestionsState(newSuggestions);
  }, []);

  /**
   * Accepts a single AI suggestion, converting it to a permanent annotation.
   * Removes the suggestion from the suggestions list and adds it to annotations.
   * Generates a new ID to avoid duplicate key issues during React rendering.
   * 
   * @param id - The ID of the suggestion to accept
   */
  const acceptSuggestion = useCallback((id: string): void => {
    setSuggestionsState((prevSuggestions) => {
      const suggestion = prevSuggestions.find((s) => s.id === id);
      if (suggestion) {
        // Add to annotations with new ID and updated source
        const acceptedAnnotation: Annotation = {
          ...suggestion,
          id: uuidv4(), // Generate new ID to avoid duplicate keys
          source: 'manual', // Once accepted, it becomes a manual annotation
          createdAt: new Date(),
        };
        setAnnotations((prev) => [...prev, acceptedAnnotation]);
      }
      // Remove from suggestions
      return prevSuggestions.filter((s) => s.id !== id);
    });
  }, []);

  /**
   * Accepts all AI suggestions, converting them to permanent annotations.
   * Clears the suggestions list and adds all to annotations.
   * Generates new IDs to avoid duplicate key issues during React rendering.
   */
  const acceptAllSuggestions = useCallback((): void => {
    setSuggestionsState((prevSuggestions) => {
      if (prevSuggestions.length > 0) {
        const acceptedAnnotations: Annotation[] = prevSuggestions.map((suggestion) => ({
          ...suggestion,
          id: uuidv4(), // Generate new ID to avoid duplicate keys
          source: 'manual' as AnnotationSource,
          createdAt: new Date(),
        }));
        setAnnotations((prev) => [...prev, ...acceptedAnnotations]);
      }
      return [];
    });
  }, []);

  /**
   * Clears all AI suggestions without affecting permanent annotations.
   */
  const clearSuggestions = useCallback((): void => {
    setSuggestionsState([]);
  }, []);

  /**
   * Returns the current annotation state organized by type.
   * Used for preparing data for save operations.
   * 
   * @returns AnnotationState with sections and questions arrays
   */
  const getAnnotationState = useCallback((): AnnotationState => {
    return {
      sections: annotations.filter((a) => a.type === 'section'),
      questions: annotations.filter((a) => a.type === 'question'),
    };
  }, [annotations]);

  return {
    annotations,
    suggestions,
    addAnnotation,
    removeAnnotation,
    setSuggestions,
    acceptSuggestion,
    acceptAllSuggestions,
    clearSuggestions,
    getAnnotationState,
  };
}

/**
 * Pure function version of addAnnotation for testing purposes.
 * Does not use React state, operates on plain arrays.
 */
export function addAnnotationPure(
  annotations: Annotation[],
  input: CreateAnnotationInput
): { annotations: Annotation[]; newAnnotation: Annotation } {
  const newAnnotation: Annotation = {
    id: uuidv4(),
    type: input.type,
    text: input.text,
    pageNumber: input.pageNumber,
    boundingRect: input.boundingRect,
    createdAt: new Date(),
    source: input.source,
  };
  return {
    annotations: [...annotations, newAnnotation],
    newAnnotation,
  };
}

/**
 * Pure function version of removeAnnotation for testing purposes.
 */
export function removeAnnotationPure(
  annotations: Annotation[],
  id: string
): Annotation[] {
  return annotations.filter((annotation) => annotation.id !== id);
}

/**
 * Pure function version of acceptSuggestion for testing purposes.
 * Generates a new ID to avoid duplicate keys.
 */
export function acceptSuggestionPure(
  annotations: Annotation[],
  suggestions: Annotation[],
  id: string
): { annotations: Annotation[]; suggestions: Annotation[] } {
  const suggestion = suggestions.find((s) => s.id === id);
  if (!suggestion) {
    return { annotations, suggestions };
  }
  
  const acceptedAnnotation: Annotation = {
    ...suggestion,
    id: uuidv4(), // Generate new ID to avoid duplicate keys
    source: 'manual',
    createdAt: new Date(),
  };
  
  return {
    annotations: [...annotations, acceptedAnnotation],
    suggestions: suggestions.filter((s) => s.id !== id),
  };
}

/**
 * Pure function version of acceptAllSuggestions for testing purposes.
 * Generates new IDs to avoid duplicate keys.
 */
export function acceptAllSuggestionsPure(
  annotations: Annotation[],
  suggestions: Annotation[]
): { annotations: Annotation[]; suggestions: Annotation[] } {
  if (suggestions.length === 0) {
    return { annotations, suggestions: [] };
  }
  
  const acceptedAnnotations: Annotation[] = suggestions.map((suggestion) => ({
    ...suggestion,
    id: uuidv4(), // Generate new ID to avoid duplicate keys
    source: 'manual' as AnnotationSource,
    createdAt: new Date(),
  }));
  
  return {
    annotations: [...annotations, ...acceptedAnnotations],
    suggestions: [],
  };
}

/**
 * Pure function version of clearSuggestions for testing purposes.
 */
export function clearSuggestionsPure(
  annotations: Annotation[],
  _suggestions: Annotation[]
): { annotations: Annotation[]; suggestions: Annotation[] } {
  return {
    annotations,
    suggestions: [],
  };
}

/**
 * Pure function version of getAnnotationState for testing purposes.
 */
export function getAnnotationStatePure(annotations: Annotation[]): AnnotationState {
  return {
    sections: annotations.filter((a) => a.type === 'section'),
    questions: annotations.filter((a) => a.type === 'question'),
  };
}
