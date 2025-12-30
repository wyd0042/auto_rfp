/**
 * Property-based tests for extraction preference persistence
 * 
 * **Feature: hybrid-question-selection**
 * 
 * These tests verify the correctness properties for preference round-trip
 * using fast-check for property-based testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ExtractionMode } from '@/types/annotation';
import { preferenceUtils } from '@/hooks/use-extraction-preference';

const { parseStoredPreference, serializePreference, STORAGE_KEY, DEFAULT_MODE } = preferenceUtils;

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid extraction modes
 */
const extractionModeArb: fc.Arbitrary<ExtractionMode> = fc.constantFrom('auto', 'manual', 'ai-assisted');

// ============================================================================
// Property Tests
// ============================================================================

describe('Extraction Preference Property Tests', () => {
  /**
   * **Feature: hybrid-question-selection, Property 8: Preference Round-Trip Consistency**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * For any extraction mode preference, storing it and then loading it SHALL
   * return the same mode value.
   */
  describe('Property 8: Preference Round-Trip Consistency', () => {
    it('should return the same mode after serialize then parse', () => {
      fc.assert(
        fc.property(extractionModeArb, (mode) => {
          // Serialize the mode
          const serialized = serializePreference(mode);
          
          // Parse it back
          const parsed = parseStoredPreference(serialized);
          
          // The mode should be the same
          expect(parsed).not.toBeNull();
          expect(parsed?.mode).toBe(mode);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve mode through multiple round-trips', () => {
      fc.assert(
        fc.property(extractionModeArb, (mode) => {
          // First round-trip
          const serialized1 = serializePreference(mode);
          const parsed1 = parseStoredPreference(serialized1);
          
          expect(parsed1).not.toBeNull();
          
          // Second round-trip using the parsed mode
          const serialized2 = serializePreference(parsed1!.mode);
          const parsed2 = parseStoredPreference(serialized2);
          
          // Mode should still be the same
          expect(parsed2?.mode).toBe(mode);
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false; // Valid JSON, filter it out
            } catch {
              return true; // Invalid JSON, keep it
            }
          }),
          (invalidJson) => {
            const parsed = parseStoredPreference(invalidJson);
            expect(parsed).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for null input', () => {
      const parsed = parseStoredPreference(null);
      expect(parsed).toBeNull();
    });

    it('should return null for JSON with invalid mode', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['auto', 'manual', 'ai-assisted'].includes(s)),
          (invalidMode) => {
            const invalidPreference = JSON.stringify({
              mode: invalidMode,
              lastUsed: new Date().toISOString(),
            });
            const parsed = parseStoredPreference(invalidPreference);
            expect(parsed).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include a valid lastUsed date after serialization', () => {
      fc.assert(
        fc.property(extractionModeArb, (mode) => {
          const serialized = serializePreference(mode);
          const parsed = parseStoredPreference(serialized);
          
          expect(parsed).not.toBeNull();
          expect(parsed?.lastUsed).toBeInstanceOf(Date);
          expect(parsed?.lastUsed.getTime()).not.toBeNaN();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Storage Key and Default Mode', () => {
    it('should have the correct storage key', () => {
      expect(STORAGE_KEY).toBe('rfp-extraction-mode-preference');
    });

    it('should have auto as the default mode', () => {
      expect(DEFAULT_MODE).toBe('auto');
    });
  });
});
