/**
 * Source Display Utility Functions
 * 
 * Provides utilities for handling source relevance colors and sorting.
 */

import type { AnswerSource } from '@/types/api';

/**
 * Type representing the color indicator for relevance scores
 */
export type RelevanceColor = 'green' | 'amber' | 'red';

/**
 * Maps a relevance score to a color indicator.
 * 
 * Color mapping:
 * - Green: relevance >= 70
 * - Amber: relevance >= 40 and < 70
 * - Red: relevance < 40 or null/undefined
 * 
 * @param relevance - The relevance score (0-100) or null/undefined
 * @returns The color indicator for the relevance score
 */
export function getRelevanceColor(relevance: number | null | undefined): RelevanceColor {
  if (relevance === null || relevance === undefined) {
    return 'red';
  }
  
  if (relevance >= 70) {
    return 'green';
  }
  
  if (relevance >= 40) {
    return 'amber';
  }
  
  return 'red';
}

/**
 * Sorts sources by relevance score in descending order.
 * 
 * Sources with null/undefined relevance are treated as having relevance 0.
 * 
 * @param sources - Array of sources to sort
 * @returns A new array of sources sorted by relevance (highest first)
 */
export function sortSourcesByRelevance(sources: AnswerSource[]): AnswerSource[] {
  return [...sources].sort((a, b) => {
    const relevanceA = a.relevance ?? 0;
    const relevanceB = b.relevance ?? 0;
    return relevanceB - relevanceA;
  });
}

/**
 * Appends source content to the current answer text.
 * 
 * If the current text is empty or only whitespace, the source content is added directly.
 * Otherwise, the source content is appended with a double newline separator.
 * 
 * **Feature: source-display-improvement, Property 5: Content Append Behavior**
 * **Validates: Requirements 5.2**
 * 
 * @param currentText - The current answer text
 * @param sourceContent - The source text content to append
 * @returns The combined text with source content appended
 */
export function appendSourceContent(currentText: string, sourceContent: string): string {
  const trimmedCurrent = currentText.trim();
  
  if (!trimmedCurrent) {
    return sourceContent;
  }
  
  return currentText + '\n\n' + sourceContent;
}
