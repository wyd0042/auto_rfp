/**
 * Hook for fetching AI suggestions from the API
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 5.1, 5.2, 5.3, 5.4**
 */

import { useState, useCallback } from 'react';
import type { Annotation } from '@/types/annotation';

/**
 * Response from the AI suggestions API
 */
interface AISuggestionsResponse {
  suggestions: {
    id: string;
    text: string;
    type: 'section' | 'question';
    confidence: number;
    pageNumber?: number;
  }[];
  documentName: string;
  generatedAt: string;
}

/**
 * Return type for the useAISuggestions hook
 */
export interface UseAISuggestionsReturn {
  /** Whether suggestions are currently being fetched */
  isLoading: boolean;
  /** Error message if the request failed */
  error: string | null;
  /** Fetch AI suggestions for the given document content */
  fetchSuggestions: (content: string, documentName: string) => Promise<Annotation[]>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Custom hook for fetching AI suggestions from the API.
 * 
 * Provides loading state, error handling, and a function to fetch suggestions.
 * Converts API response to Annotation format for use in the PDFAnnotator.
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 5.1**
 * 
 * @returns Object with loading state, error, and fetch function
 * 
 * @example
 * ```tsx
 * const { isLoading, error, fetchSuggestions } = useAISuggestions();
 * 
 * const handleAISuggest = async () => {
 *   const suggestions = await fetchSuggestions(documentContent, documentName);
 *   setSuggestions(suggestions);
 * };
 * ```
 */
export function useAISuggestions(): UseAISuggestionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch AI suggestions from the API
   * 
   * @param content - The text content of the document
   * @param documentName - Name of the document
   * @returns Array of Annotation objects representing suggestions
   */
  const fetchSuggestions = useCallback(
    async (content: string, documentName: string): Promise<Annotation[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            documentName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch suggestions: ${response.status}`);
        }

        const data: AISuggestionsResponse = await response.json();

        // Convert API response to Annotation format
        const annotations: Annotation[] = data.suggestions.map((suggestion) => ({
          id: suggestion.id,
          type: suggestion.type,
          text: suggestion.text,
          pageNumber: suggestion.pageNumber || 1,
          createdAt: new Date(data.generatedAt),
          source: 'ai-suggestion' as const,
        }));

        return annotations;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch AI suggestions';
        setError(errorMessage);
        console.error('[useAISuggestions] Error:', errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    fetchSuggestions,
    clearError,
  };
}

export default useAISuggestions;
