/**
 * Text Improvement Types and Constants
 *
 * Shared types and constants for text improvement feature.
 * This file is safe to import from both client and server components.
 *
 * **Feature: ai-response-improvement**
 */

/**
 * Available improvement action types
 */
export type ImprovementAction =
  | 'proofread'
  | 'make_professional'
  | 'make_concise'
  | 'convert_to_bullets';

/**
 * Result of a text improvement operation
 */
export interface TextImprovementResult {
  improvedText: string;
  action: ImprovementAction;
  originalLength: number;
  improvedLength: number;
}

/**
 * Configuration for improvement actions including prompts and icons
 */
export const IMPROVEMENT_ACTIONS = {
  proofread: {
    id: 'proofread',
    label: 'Proofread',
    icon: 'SpellCheck',
    description: 'Fix grammar, spelling, and clarity',
  },
  make_professional: {
    id: 'make_professional',
    label: 'Professional',
    icon: 'Briefcase',
    description: 'Make formal and business-appropriate',
  },
  make_concise: {
    id: 'make_concise',
    label: 'Concise',
    icon: 'Minimize2',
    description: 'Reduce length, keep key info',
  },
  convert_to_bullets: {
    id: 'convert_to_bullets',
    label: 'Bullets',
    icon: 'List',
    description: 'Convert to bullet points',
  },
} as const;
