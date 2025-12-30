/**
 * Type definitions for the Hybrid Question Selection feature
 * Supports Manual Selection and AI-Assisted extraction modes
 */

/**
 * Extraction mode options for question selection
 * - auto: Existing Gemini AI extraction without additional user input
 * - manual: User manually selects text from PDF viewer
 * - ai-assisted: AI suggests questions that user can accept/reject
 */
export type ExtractionMode = 'auto' | 'manual' | 'ai-assisted';

/**
 * Type of annotation - either a section header or a question
 */
export type AnnotationType = 'section' | 'question';

/**
 * Source of the annotation - manually created or AI-suggested
 */
export type AnnotationSource = 'manual' | 'ai-suggestion';

/**
 * Bounding rectangle for annotation positioning on PDF
 */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a single annotation on the document
 * Can be either a section or question, created manually or by AI
 */
export interface Annotation {
  id: string;
  type: AnnotationType;
  text: string;
  pageNumber: number;
  boundingRect?: BoundingRect;
  createdAt: Date;
  source: AnnotationSource;
}

/**
 * Collection of all annotations in the current document session
 * Organized by type for easy access
 */
export interface AnnotationState {
  sections: Annotation[];
  questions: Annotation[];
}

/**
 * Represents a text selection made by the user in the PDF viewer
 */
export interface TextSelection {
  text: string;
  pageNumber: number;
  boundingRect: DOMRect;
  startOffset: number;
  endOffset: number;
}

/**
 * AI-generated suggestion for a potential annotation
 * Includes confidence score for ranking suggestions
 */
export interface SuggestedAnnotation {
  text: string;
  type: AnnotationType;
  confidence: number;
  pageNumber?: number;
}

/**
 * Request payload for saving annotations to the database
 * Organizes questions under their associated sections
 */
export interface SaveAnnotationsRequest {
  projectId: string;
  documentName: string;
  sections: SaveAnnotationSection[];
}

/**
 * Section structure for save request
 */
export interface SaveAnnotationSection {
  title: string;
  questions: SaveAnnotationQuestion[];
}

/**
 * Question structure for save request
 */
export interface SaveAnnotationQuestion {
  text: string;
  referenceId?: string;
}

/**
 * User's extraction mode preference stored in localStorage
 */
export interface ExtractionPreference {
  mode: ExtractionMode;
  lastUsed: Date;
}
