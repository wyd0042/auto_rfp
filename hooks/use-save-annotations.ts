/**
 * Hook for saving annotations with navigation and error handling
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 6.1, 6.2, 6.3, 6.4**
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { saveAnnotations } from '@/lib/services/save-annotations-service';
import type { AnnotationState } from '@/types/annotation';

/**
 * Return type for the useSaveAnnotations hook
 */
export interface UseSaveAnnotationsReturn {
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** The last error that occurred during save, if any */
  error: Error | null;
  /** The preserved annotation state for retry (set on error) */
  preservedState: AnnotationState | null;
  /** Function to save annotations and navigate on success */
  save: (
    projectId: string,
    annotationState: AnnotationState,
    documentName: string
  ) => Promise<boolean>;
  /** Function to retry the last failed save */
  retry: () => Promise<boolean>;
  /** Function to clear the error state */
  clearError: () => void;
}

/**
 * Custom hook for saving annotations with navigation and error handling.
 * 
 * Handles:
 * - Saving annotations to the database via API
 * - Navigating to questions page on success
 * - Displaying error messages on failure
 * - Preserving annotation state for retry
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 6.1, 6.2, 6.3, 6.4**
 * 
 * @returns Object containing save state and functions
 */
export function useSaveAnnotations(): UseSaveAnnotationsReturn {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preservedState, setPreservedState] = useState<AnnotationState | null>(null);
  
  // Store last save parameters for retry
  const lastSaveParams = useRef<{
    projectId: string;
    annotationState: AnnotationState;
    documentName: string;
  } | null>(null);

  /**
   * Saves annotations and navigates to questions page on success.
   * On failure, preserves the annotation state for retry.
   * 
   * **Requirements: 6.1, 6.2, 6.3, 6.4**
   * 
   * @param projectId - The project ID to save to
   * @param annotationState - The current annotation state
   * @param documentName - The name of the document being annotated
   * @returns Promise resolving to true on success, false on failure
   */
  const save = useCallback(async (
    projectId: string,
    annotationState: AnnotationState,
    documentName: string
  ): Promise<boolean> => {
    // Store parameters for potential retry
    lastSaveParams.current = { projectId, annotationState, documentName };
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Validate that we have something to save
      const totalAnnotations = annotationState.sections.length + annotationState.questions.length;
      if (totalAnnotations === 0) {
        throw new Error('No annotations to save. Please select at least one section or question.');
      }
      
      // Save annotations via API
      const result = await saveAnnotations(projectId, annotationState, documentName);
      
      // Show success toast
      toast({
        title: 'Questions saved',
        description: result.message,
      });
      
      // Clear preserved state on success
      setPreservedState(null);
      lastSaveParams.current = null;
      
      // Navigate to questions page
      // **Requirement 6.3**: WHEN saving is complete THEN the Question_Selection_System 
      // SHALL navigate the user to the questions page showing the saved questions
      router.push(`/projects/${projectId}/questions`);
      
      return true;
    } catch (err) {
      const saveError = err instanceof Error ? err : new Error('Failed to save questions');
      
      // **Requirement 6.4**: IF saving fails THEN the Question_Selection_System 
      // SHALL display an error message and preserve the Annotation_State for retry
      setError(saveError);
      setPreservedState(annotationState);
      
      // Show error toast
      toast({
        title: 'Failed to save questions',
        description: saveError.message,
        variant: 'destructive',
      });
      
      console.error('Save annotations error:', saveError);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [router]);

  /**
   * Retries the last failed save operation.
   * Uses the preserved annotation state and last save parameters.
   * 
   * @returns Promise resolving to true on success, false on failure
   */
  const retry = useCallback(async (): Promise<boolean> => {
    if (!lastSaveParams.current) {
      toast({
        title: 'Cannot retry',
        description: 'No previous save operation to retry.',
        variant: 'destructive',
      });
      return false;
    }
    
    const { projectId, annotationState, documentName } = lastSaveParams.current;
    return save(projectId, annotationState, documentName);
  }, [save]);

  /**
   * Clears the error state and preserved annotation state.
   */
  const clearError = useCallback(() => {
    setError(null);
    setPreservedState(null);
    lastSaveParams.current = null;
  }, []);

  return {
    isSaving,
    error,
    preservedState,
    save,
    retry,
    clearError,
  };
}
