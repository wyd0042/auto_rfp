"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, HelpCircle, Trash2, Sparkles, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import type { Annotation } from '@/types/annotation'

/**
 * Props for the AnnotationSidebar component
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 3.5, 4.1, 4.3, 4.4, 5.4, 5.5**
 */
export interface AnnotationSidebarProps {
  /** List of permanent annotations to display */
  annotations: Annotation[]
  /** Callback when delete button is clicked on an annotation */
  onDelete: (id: string) => void
  /** Callback when an annotation is clicked for navigation */
  onNavigate: (id: string) => void
  /** Callback when Accept All button is clicked (AI-Assisted mode) */
  onAcceptAll?: () => void
  /** Callback when Clear Suggestions button is clicked (AI-Assisted mode) */
  onClearSuggestions?: () => void
  /** List of AI suggestions (AI-Assisted mode) */
  suggestions?: Annotation[]
  /** Current extraction mode */
  mode: 'manual' | 'ai-assisted'
  /** ID of the currently selected annotation */
  selectedAnnotationId?: string | null
}

/**
 * AnnotationSidebar Component
 * 
 * Displays and manages the list of annotations in the PDF annotator.
 * Shows sections and questions with color coding, delete buttons,
 * and navigation functionality.
 * 
 * Features:
 * - Display list of sections (blue) and questions (yellow)
 * - Delete button for each annotation
 * - Click-to-navigate to annotation location
 * - AI suggestion controls in AI-Assisted mode
 * - Empty state message when no annotations exist
 * - Keyboard navigation with arrow keys
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 3.5, 4.1, 4.3, 4.4, 5.4, 5.5**
 */
export function AnnotationSidebar({
  annotations,
  onDelete,
  onNavigate,
  onAcceptAll,
  onClearSuggestions,
  suggestions = [],
  mode,
  selectedAnnotationId,
}: AnnotationSidebarProps) {
  // Separate annotations by type
  const sections = annotations.filter((a) => a.type === 'section')
  const questions = annotations.filter((a) => a.type === 'question')
  
  const hasAnnotations = annotations.length > 0
  const hasSuggestions = suggestions.length > 0
  const isEmpty = !hasAnnotations && !hasSuggestions

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  // Create a flat list of all annotation IDs for keyboard navigation
  const allAnnotationIds = [...sections.map(s => s.id), ...questions.map(q => q.id)]
  const totalItems = allAnnotationIds.length

  /**
   * Handle keyboard navigation in the sidebar
   * - ArrowUp/ArrowDown: Navigate between annotations
   * - Enter/Space: Navigate to the focused annotation
   * - Delete/Backspace: Delete the focused annotation
   * - Home: Go to first annotation
   * - End: Go to last annotation
   * 
   * **Feature: hybrid-question-selection**
   * **Requirements: 4.3 - Keyboard navigation for sidebar**
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (totalItems === 0) return

    switch (event.key) {
      case 'ArrowDown':
      case 'j': // Vim-style navigation
        event.preventDefault()
        setFocusedIndex(prev => {
          const next = prev < totalItems - 1 ? prev + 1 : 0
          return next
        })
        break
      case 'ArrowUp':
      case 'k': // Vim-style navigation
        event.preventDefault()
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : totalItems - 1
          return next
        })
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < totalItems) {
          onNavigate(allAnnotationIds[focusedIndex])
        }
        break
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < totalItems) {
          const idToDelete = allAnnotationIds[focusedIndex]
          onDelete(idToDelete)
          // Adjust focus after deletion
          if (focusedIndex >= totalItems - 1) {
            setFocusedIndex(Math.max(0, totalItems - 2))
          }
        }
        break
      case 'Home':
        event.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        event.preventDefault()
        setFocusedIndex(totalItems - 1)
        break
    }
  }, [totalItems, focusedIndex, allAnnotationIds, onNavigate, onDelete])

  // Update focused index when selected annotation changes externally
  useEffect(() => {
    if (selectedAnnotationId) {
      const index = allAnnotationIds.indexOf(selectedAnnotationId)
      if (index !== -1) {
        setFocusedIndex(index)
      }
    }
  }, [selectedAnnotationId, allAnnotationIds])

  // Get the focused annotation ID
  const focusedAnnotationId = focusedIndex >= 0 && focusedIndex < totalItems 
    ? allAnnotationIds[focusedIndex] 
    : null

  return (
    <div 
      ref={sidebarRef}
      className="flex flex-col h-full border-l bg-background focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Annotations list"
      aria-activedescendant={focusedAnnotationId ? `annotation-${focusedAnnotationId}` : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Annotations</h3>
        <div className="flex items-center gap-2">
          {hasAnnotations && (
            <Badge variant="secondary" className="text-xs">
              {annotations.length}
            </Badge>
          )}
        </div>
      </div>

      {/* AI Suggestion Controls (AI-Assisted mode only) */}
      {mode === 'ai-assisted' && hasSuggestions && (
        <SuggestionControls
          suggestionCount={suggestions.length}
          onAcceptAll={onAcceptAll}
          onClearSuggestions={onClearSuggestions}
        />
      )}

      {/* Content Area */}
      <ScrollArea className="flex-1">
        {isEmpty ? (
          <EmptyState mode={mode} />
        ) : (
          <div className="p-3 space-y-4">
            {/* Keyboard navigation hint */}
            {hasAnnotations && (
              <div className="text-[10px] text-muted-foreground text-center pb-2 border-b">
                ↑↓ Navigate • Enter Select • Del Remove
              </div>
            )}
            
            {/* Sections List */}
            {sections.length > 0 && (
              <AnnotationGroup
                title="Sections"
                annotations={sections}
                onDelete={onDelete}
                onNavigate={onNavigate}
                selectedAnnotationId={selectedAnnotationId}
                focusedAnnotationId={focusedAnnotationId}
              />
            )}

            {/* Questions List */}
            {questions.length > 0 && (
              <AnnotationGroup
                title="Questions"
                annotations={questions}
                onDelete={onDelete}
                onNavigate={onNavigate}
                selectedAnnotationId={selectedAnnotationId}
                focusedAnnotationId={focusedAnnotationId}
              />
            )}

            {/* AI Suggestions List (AI-Assisted mode) */}
            {mode === 'ai-assisted' && hasSuggestions && (
              <SuggestionGroup
                suggestions={suggestions}
                selectedAnnotationId={selectedAnnotationId}
              />
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}


/**
 * Props for SuggestionControls component
 */
interface SuggestionControlsProps {
  suggestionCount: number
  onAcceptAll?: () => void
  onClearSuggestions?: () => void
}

/**
 * Controls for managing AI suggestions
 * Shows Accept All and Clear Suggestions buttons with suggestion count
 */
function SuggestionControls({
  suggestionCount,
  onAcceptAll,
  onClearSuggestions,
}: SuggestionControlsProps) {
  return (
    <div className="px-4 py-3 border-b bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">AI Suggestions</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {suggestionCount}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={onAcceptAll}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Accept All
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={onClearSuggestions}
        >
          <XCircle className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  )
}

/**
 * Props for AnnotationGroup component
 */
interface AnnotationGroupProps {
  title: string
  annotations: Annotation[]
  onDelete: (id: string) => void
  onNavigate: (id: string) => void
  selectedAnnotationId?: string | null
  focusedAnnotationId?: string | null
}

/**
 * Group of annotations with a title header
 */
function AnnotationGroup({
  title,
  annotations,
  onDelete,
  onNavigate,
  selectedAnnotationId,
  focusedAnnotationId,
}: AnnotationGroupProps) {
  const isSection = annotations[0]?.type === 'section'
  const Icon = isSection ? FileText : HelpCircle
  const colorClass = isSection ? 'text-blue-500' : 'text-yellow-500'

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', colorClass)} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {annotations.length}
        </Badge>
      </div>
      <div className="space-y-1" role="group" aria-label={title}>
        {annotations.map((annotation) => (
          <AnnotationItem
            key={annotation.id}
            annotation={annotation}
            onDelete={onDelete}
            onNavigate={onNavigate}
            isSelected={annotation.id === selectedAnnotationId}
            isFocused={annotation.id === focusedAnnotationId}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Props for AnnotationItem component
 */
interface AnnotationItemProps {
  annotation: Annotation
  onDelete: (id: string) => void
  onNavigate: (id: string) => void
  isSelected?: boolean
  isFocused?: boolean
}

/**
 * Individual annotation item with text, page number, and delete button
 * Supports keyboard focus indication for accessibility
 */
function AnnotationItem({
  annotation,
  onDelete,
  onNavigate,
  isSelected,
  isFocused,
}: AnnotationItemProps) {
  const isSection = annotation.type === 'section'
  const itemRef = useRef<HTMLDivElement>(null)
  
  // Scroll into view when focused via keyboard
  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isFocused])
  
  const handleClick = useCallback(() => {
    onNavigate(annotation.id)
  }, [annotation.id, onNavigate])

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(annotation.id)
    },
    [annotation.id, onDelete]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onNavigate(annotation.id)
      }
    },
    [annotation.id, onNavigate]
  )

  return (
    <div
      ref={itemRef}
      id={`annotation-${annotation.id}`}
      role="option"
      tabIndex={-1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
      className={cn(
        'group flex items-start gap-2 p-2 rounded-md cursor-pointer transition-all duration-150',
        'hover:bg-accent/50',
        isSelected && 'bg-accent ring-1 ring-ring',
        isFocused && !isSelected && 'bg-accent/30 ring-1 ring-ring/50',
        isSection ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-yellow-500'
      )}
      aria-label={`${annotation.type}: ${annotation.text}`}
      data-annotation-id={annotation.id}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm line-clamp-2 break-words">
          {annotation.text}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Page {annotation.pageNumber}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
        onClick={handleDelete}
        aria-label={`Delete ${annotation.type}`}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  )
}


/**
 * Props for SuggestionGroup component
 */
interface SuggestionGroupProps {
  suggestions: Annotation[]
  selectedAnnotationId?: string | null
}

/**
 * Group of AI suggestions (display only, no delete)
 */
function SuggestionGroup({
  suggestions,
  selectedAnnotationId,
}: SuggestionGroupProps) {
  const sections = suggestions.filter((s) => s.type === 'section')
  const questions = suggestions.filter((s) => s.type === 'question')

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Suggestions
        </span>
      </div>
      <div className="space-y-1">
        {sections.map((suggestion) => (
          <SuggestionItem
            key={suggestion.id}
            suggestion={suggestion}
            isSelected={suggestion.id === selectedAnnotationId}
          />
        ))}
        {questions.map((suggestion) => (
          <SuggestionItem
            key={suggestion.id}
            suggestion={suggestion}
            isSelected={suggestion.id === selectedAnnotationId}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Props for SuggestionItem component
 */
interface SuggestionItemProps {
  suggestion: Annotation
  isSelected?: boolean
}

/**
 * Individual suggestion item (display only)
 */
function SuggestionItem({ suggestion, isSelected }: SuggestionItemProps) {
  const isSection = suggestion.type === 'section'

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-md',
        'bg-purple-50/50 dark:bg-purple-950/20',
        'border border-dashed',
        isSelected && 'ring-1 ring-purple-500',
        isSection ? 'border-blue-300' : 'border-yellow-300'
      )}
      data-suggestion-id={suggestion.id}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          {isSection ? (
            <FileText className="h-3 w-3 text-blue-500" />
          ) : (
            <HelpCircle className="h-3 w-3 text-yellow-500" />
          )}
          <span className="text-xs text-muted-foreground">
            {isSection ? 'Section' : 'Question'}
          </span>
        </div>
        <p className="text-sm line-clamp-2 break-words">
          {suggestion.text}
        </p>
        {suggestion.pageNumber && (
          <p className="text-xs text-muted-foreground mt-1">
            Page {suggestion.pageNumber}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Props for EmptyState component
 */
interface EmptyStateProps {
  mode: 'manual' | 'ai-assisted'
}

/**
 * Empty state message when no annotations exist
 * 
 * **Requirements: 4.4**
 */
function EmptyState({ mode }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="text-sm font-medium mb-1">No annotations yet</h4>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        {mode === 'ai-assisted'
          ? 'Select text in the PDF or click "AI Suggest" to get started.'
          : 'Select text in the PDF to mark sections and questions.'}
      </p>
    </div>
  )
}

export default AnnotationSidebar
