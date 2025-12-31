"use client"

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'autorpf_source_panel_expanded'
const DEFAULT_EXPANDED = false

/**
 * Interface for the useSourcePanel hook return type
 */
export interface UseSourcePanelReturn {
  isExpanded: boolean
  toggle: () => void
  setExpanded: (expanded: boolean) => void
}

/**
 * Parses a stored panel state from localStorage
 * Returns null if parsing fails or data is invalid
 */
function parseStoredState(stored: string | null): boolean | null {
  if (stored === null) return null
  
  try {
    const parsed = JSON.parse(stored)
    
    // Validate the parsed value is a boolean
    if (typeof parsed === 'boolean') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Serializes a panel state for localStorage storage
 */
function serializeState(expanded: boolean): string {
  return JSON.stringify(expanded)
}

/**
 * Hook for managing Source Panel expanded/collapsed state with localStorage persistence
 * 
 * Features:
 * - Loads preference from localStorage on mount
 * - Defaults to collapsed (false) when no preference exists
 * - Stores preference in localStorage when changed
 * - Handles invalid/corrupted localStorage data gracefully
 * 
 * **Feature: source-display-improvement**
 * 
 * @returns Object containing current expanded state and control functions
 */
export function useSourcePanel(): UseSourcePanelReturn {
  const [isExpanded, setIsExpandedState] = useState<boolean>(DEFAULT_EXPANDED)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const state = parseStoredState(stored)
      
      if (state !== null) {
        setIsExpandedState(state)
      }
    } catch {
      // localStorage not available, use default
    }
    setIsLoaded(true)
  }, [])

  // Set expanded state and persist to localStorage
  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpandedState(expanded)
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, serializeState(expanded))
      } catch {
        // localStorage not available, state still updated in memory
      }
    }
  }, [])

  // Toggle the expanded state
  const toggle = useCallback(() => {
    setExpanded(!isExpanded)
  }, [isExpanded, setExpanded])

  return {
    isExpanded,
    toggle,
    setExpanded,
  }
}

/**
 * Utility functions exported for testing purposes
 */
export const sourcePanelUtils = {
  STORAGE_KEY,
  DEFAULT_EXPANDED,
  parseStoredState,
  serializeState,
}
