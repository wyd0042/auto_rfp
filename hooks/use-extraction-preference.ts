"use client"

import { useState, useEffect, useCallback } from 'react'
import { ExtractionMode, ExtractionPreference } from '@/types/annotation'

const STORAGE_KEY = 'rfp-extraction-mode-preference'
const DEFAULT_MODE: ExtractionMode = 'auto'

/**
 * Parses a stored preference from localStorage
 * Returns null if parsing fails or data is invalid
 */
function parseStoredPreference(stored: string | null): ExtractionPreference | null {
  if (!stored) return null
  
  try {
    const parsed = JSON.parse(stored)
    
    // Validate the parsed object has required fields
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.mode === 'string' &&
      ['auto', 'manual', 'ai-assisted'].includes(parsed.mode) &&
      typeof parsed.lastUsed === 'string'
    ) {
      return {
        mode: parsed.mode as ExtractionMode,
        lastUsed: new Date(parsed.lastUsed),
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Serializes a preference for localStorage storage
 */
function serializePreference(mode: ExtractionMode): string {
  const preference: ExtractionPreference = {
    mode,
    lastUsed: new Date(),
  }
  return JSON.stringify(preference)
}

/**
 * Hook for managing extraction mode preference with localStorage persistence
 * 
 * Features:
 * - Loads preference from localStorage on mount
 * - Defaults to 'auto' when no preference exists
 * - Stores preference in localStorage when changed
 * - Handles invalid/corrupted localStorage data gracefully
 * 
 * @returns Object containing current mode and setter function
 */
export function useExtractionPreference() {
  const [mode, setModeState] = useState<ExtractionMode>(DEFAULT_MODE)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem(STORAGE_KEY)
    const preference = parseStoredPreference(stored)
    
    if (preference) {
      setModeState(preference.mode)
    }
    setIsLoaded(true)
  }, [])

  // Set mode and persist to localStorage
  const setMode = useCallback((newMode: ExtractionMode) => {
    setModeState(newMode)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, serializePreference(newMode))
    }
  }, [])

  return {
    mode,
    setMode,
    isLoaded,
  }
}

/**
 * Utility functions exported for testing purposes
 */
export const preferenceUtils = {
  STORAGE_KEY,
  DEFAULT_MODE,
  parseStoredPreference,
  serializePreference,
}
