"use client"

import React, { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Annotation, BoundingRect } from '@/types/annotation'

/**
 * Props for the AnnotationHighlight component
 */
export interface AnnotationHighlightProps {
  /** The annotation to render as a highlight */
  annotation: Annotation
  /** Current zoom level of the PDF viewer */
  zoom: number
  /** Whether this is an AI suggestion (shows pulsing animation) */
  isSuggestion?: boolean
  /** Whether this highlight is currently selected/active */
  isSelected?: boolean
  /** Callback when the highlight is clicked */
  onClick?: (annotation: Annotation) => void
}

/**
 * Style configuration for annotation types
 */
const ANNOTATION_STYLES = {
  section: {
    base: 'bg-blue-500/30 border-blue-500/50',
    suggestion: 'bg-blue-400/40 border-blue-400',
    selected: 'bg-blue-500/50 border-blue-600',
  },
  question: {
    base: 'bg-yellow-500/30 border-yellow-500/50',
    suggestion: 'bg-yellow-400/40 border-yellow-400',
    selected: 'bg-yellow-500/50 border-yellow-600',
  },
} as const

/**
 * AnnotationHighlight Component
 * 
 * Renders a colored overlay on the PDF for a single annotation.
 * - Blue highlights for sections
 * - Yellow highlights for questions
 * - Pulsing animation for AI suggestions
 * - Dashed border for suggestions to distinguish from permanent annotations
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 3.3, 3.4, 5.2**
 * 
 * @param props - Component props
 * @returns Rendered highlight overlay element or null if no bounding rect
 */
export function AnnotationHighlight({
  annotation,
  zoom,
  isSuggestion = false,
  isSelected = false,
  onClick,
}: AnnotationHighlightProps) {
  // Don't render if no bounding rect is available
  if (!annotation.boundingRect) {
    return null
  }

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick?.(annotation)
    },
    [annotation, onClick]
  )

  const { type } = annotation
  const styles = ANNOTATION_STYLES[type]

  // Calculate position and size based on zoom level
  const style = calculateHighlightStyle(annotation.boundingRect, zoom)

  // Build class names based on state
  const className = cn(
    // Base styles
    'absolute pointer-events-auto cursor-pointer transition-all duration-200',
    'border rounded-sm',
    // Type-specific colors
    isSelected
      ? styles.selected
      : isSuggestion
        ? styles.suggestion
        : styles.base,
    // Suggestion-specific styles
    isSuggestion && 'border-2 border-dashed animate-pulse',
    // Selected state
    isSelected && 'ring-2 ring-offset-1',
    isSelected && type === 'section' && 'ring-blue-600',
    isSelected && type === 'question' && 'ring-yellow-600',
    // Hover effect for non-suggestions
    !isSuggestion && 'hover:opacity-80'
  )

  // Generate tooltip text
  const tooltipText = generateTooltip(annotation, isSuggestion)

  return (
    <div
      className={className}
      style={style}
      onClick={handleClick}
      title={tooltipText}
      role="button"
      tabIndex={0}
      aria-label={tooltipText}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(annotation)
        }
      }}
      data-annotation-id={annotation.id}
      data-annotation-type={annotation.type}
      data-is-suggestion={isSuggestion}
    />
  )
}

/**
 * Calculate the CSS style object for positioning the highlight
 * 
 * @param boundingRect - The bounding rectangle of the annotation
 * @param zoom - Current zoom level
 * @returns CSS properties for positioning
 */
function calculateHighlightStyle(
  boundingRect: BoundingRect,
  zoom: number
): React.CSSProperties {
  return {
    left: boundingRect.x * zoom,
    top: boundingRect.y * zoom,
    width: boundingRect.width * zoom,
    height: boundingRect.height * zoom,
  }
}

/**
 * Generate tooltip text for the annotation
 * 
 * @param annotation - The annotation
 * @param isSuggestion - Whether this is an AI suggestion
 * @returns Tooltip string
 */
function generateTooltip(annotation: Annotation, isSuggestion: boolean): string {
  const prefix = isSuggestion ? 'AI Suggestion' : annotation.type === 'section' ? 'Section' : 'Question'
  const truncatedText = annotation.text.length > 50 
    ? `${annotation.text.substring(0, 50)}...` 
    : annotation.text
  return `${prefix}: ${truncatedText}`
}

export default AnnotationHighlight


/**
 * Props for the AnnotationHighlightList component
 */
export interface AnnotationHighlightListProps {
  /** List of permanent annotations to display */
  annotations: Annotation[]
  /** List of AI suggestions to display with pulsing animation */
  suggestions: Annotation[]
  /** Current zoom level of the PDF viewer */
  zoom: number
  /** ID of the currently selected annotation (if any) */
  selectedAnnotationId?: string | null
  /** Callback when an annotation is clicked */
  onAnnotationClick?: (annotation: Annotation) => void
  /** Callback when a suggestion is clicked */
  onSuggestionClick?: (suggestion: Annotation) => void
}

/**
 * AnnotationHighlightList Component
 * 
 * Renders all annotation highlights as an overlay on the PDF page.
 * Handles both permanent annotations and AI suggestions.
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 3.3, 3.4, 5.2, 5.3**
 * 
 * @param props - Component props
 * @returns Overlay container with all highlights
 */
export function AnnotationHighlightList({
  annotations,
  suggestions,
  zoom,
  selectedAnnotationId,
  onAnnotationClick,
  onSuggestionClick,
}: AnnotationHighlightListProps) {
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      data-testid="annotation-highlight-list"
    >
      {/* Render permanent annotations */}
      {annotations.map((annotation) => (
        <AnnotationHighlight
          key={annotation.id}
          annotation={annotation}
          zoom={zoom}
          isSuggestion={false}
          isSelected={annotation.id === selectedAnnotationId}
          onClick={onAnnotationClick}
        />
      ))}
      
      {/* Render AI suggestions with pulsing animation */}
      {suggestions.map((suggestion) => (
        <AnnotationHighlight
          key={suggestion.id}
          annotation={suggestion}
          zoom={zoom}
          isSuggestion={true}
          isSelected={suggestion.id === selectedAnnotationId}
          onClick={onSuggestionClick}
        />
      ))}
    </div>
  )
}
