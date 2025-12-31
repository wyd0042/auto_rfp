/**
 * Hook for text improvement functionality
 *
 * Manages loading state, error state, and undo functionality for text improvement.
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4**
 */

import { useState, useCallback, useMemo } from 'react';
import type { ImprovementAction } from '@/lib/services/text-improvement-types';

/**
 * Undo state storage structure
 */
export interface UndoState {
  previousText: string;
  action: ImprovementAction;
  timestamp: number;
}

/**
 * Return type for the useTextImprovement hook
 */
export interface UseTextImprovementReturn {
  /** Improve text using the specified action */
  improve: (text: string, action: ImprovementAction) => Promise<string>;
  /** Whether an improvement is currently in progress */
  isLoading: boolean;
  /** Error message if the last request failed */
  error: string | null;
  /** Whether undo is available */
  canUndo: boolean;
  /** Undo the last improvement and return the previous text */
  undo: () => string | null;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * API response structure for improve-text endpoint
 */
interface ImproveTextResponse {
  improvedText: string;
  action: string;
  originalLength: number;
  improvedLength: number;
}

/**
 * Custom hook for text improvement functionality.
 *
 * Provides:
 * - Loading state management during API calls
 * - Error state management for failed requests
 * - Undo functionality to restore previous text
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4**
 *
 * @returns Object with improve function, loading/error states, and undo functionality
 *
 * @example
 * ```tsx
 * const { improve, isLoading, error, canUndo, undo } = useTextImprovement();
 *
 * const handleImprove = async () => {
 *   const improved = await improve(text, 'proofread');
 *   setText(improved);
 * };
 *
 * const handleUndo = () => {
 *   const previous = undo();
 *   if (previous) setText(previous);
 * };
 * ```
 */
export function useTextImprovement(): UseTextImprovementReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  /**
   * Improve text using the specified action
   *
   * **Requirements: 1.2, 1.3, 1.4, 6.1, 6.4**
   *
   * @param text - The text to improve
   * @param action - The improvement action to apply
   * @returns The improved text
   * @throws Error if the API call fails
   */
  const improve = useCallback(
    async (text: string, action: ImprovementAction): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/improve-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, action }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to improve text: ${response.status}`
          );
        }

        const data: ImproveTextResponse = await response.json();

        // Store original text for undo before returning improved text
        // **Requirements: 6.1, 6.4**
        setUndoState({
          previousText: text,
          action,
          timestamp: Date.now(),
        });

        return data.improvedText;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to improve text';
        setError(errorMessage);
        console.error('[useTextImprovement] Error:', errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Undo the last improvement and return the previous text
   *
   * **Requirements: 6.2, 6.3**
   *
   * @returns The previous text, or null if no undo is available
   */
  const undo = useCallback((): string | null => {
    if (!undoState) {
      return null;
    }

    const previousText = undoState.previousText;
    // Clear undo state after restoring
    // **Requirements: 6.3**
    setUndoState(null);
    return previousText;
  }, [undoState]);

  /**
   * Whether undo is available
   *
   * **Requirements: 6.1**
   */
  const canUndo = useMemo(() => undoState !== null, [undoState]);

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    improve,
    isLoading,
    error,
    canUndo,
    undo,
    clearError,
  };
}

export default useTextImprovement;
