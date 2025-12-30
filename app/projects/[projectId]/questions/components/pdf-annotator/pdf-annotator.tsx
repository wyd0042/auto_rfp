"use client"

import React, { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Save, X, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnnotationState, CreateAnnotationInput } from '@/hooks/use-annotation-state'
import { useAISuggestions } from '@/hooks/use-ai-suggestions'
import { useSaveAnnotations } from '@/hooks/use-save-annotations'
import type { Annotation, AnnotationState, TextSelection, AnnotationType } from '@/types/annotation'
import { PDFViewer } from './pdf-viewer'
import { AnnotationSidebar } from './annotation-sidebar'
import { toast } from '@/components/ui/use-toast'

/**
 * Props for the PDFAnnotator component
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 1.3, 1.4, 5.1, 6.1**
 */
export interface PDFAnnotatorProps {
  /** Project ID for saving annotations */
  projectId: string
  /** PDF URL or data as ArrayBuffer */
  pdfUrl?: string
  /** PDF data as ArrayBuffer (alternative to pdfUrl) */
  pdfData?: ArrayBuffer
  /** Document text content for AI suggestions */
  documentContent?: string
  /** Name of the document being annotated */
  documentName: string
  /** Extraction mode - manual or ai-assisted */
  mode: 'manual' | 'ai-assisted'
  /** Callback when user saves annotations (optional, for custom handling) */
  onSave?: (annotations: AnnotationState) => void
  /** Callback when user cancels annotation */
  onCancel: () => void
}

/**
 * PDFAnnotator Component
 * 
 * Main container component for the PDF annotation feature.
 * Combines PDFViewer, AnnotationSidebar, and context menu.
 * Manages annotation state with useAnnotationState hook.
 * Handles mode-specific behavior (manual vs AI-assisted).
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 1.3, 1.4**
 * 
 * - Requirement 1.3: WHEN a user selects Manual Selection mode THEN the 
 *   Question_Selection_System SHALL display the PDF_Viewer after document 
 *   upload for manual text selection
 * - Requirement 1.4: WHEN a user selects AI-Assisted mode THEN the 
 *   Question_Selection_System SHALL display AI_Suggestions on the PDF_Viewer 
 *   for user validation
 */
export function PDFAnnotator({
  projectId,
  pdfUrl,
  pdfData,
  documentContent,
  documentName,
  mode,
  onSave,
  onCancel,
}: PDFAnnotatorProps) {
  // PDF viewer state
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(1.0)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  
  // Annotation state management
  const {
    annotations,
    suggestions,
    addAnnotation,
    removeAnnotation,
    setSuggestions,
    acceptSuggestion,
    acceptAllSuggestions,
    clearSuggestions,
    getAnnotationState,
  } = useAnnotationState()

  // AI suggestions hook
  const { isLoading: isLoadingAISuggestions, fetchSuggestions } = useAISuggestions()

  // Save annotations hook
  const { 
    isSaving, 
    error: saveError, 
    save: saveAnnotationsToDb, 
    retry: retrySave,
    clearError: clearSaveError 
  } = useSaveAnnotations()

  // Reference to PDF viewer for scrolling
  const pdfViewerRef = useRef<HTMLDivElement>(null)

  // Determine PDF source
  const pdfSource = pdfData || pdfUrl || ''

  /**
   * Handle document load success
   */
  const handleDocumentLoad = useCallback((pages: number) => {
    // Pages count available for future use (e.g., page navigation limits)
    console.log(`Document loaded with ${pages} pages`)
  }, [])

  /**
   * Handle text selection and tagging from PDF viewer
   * Creates a new annotation from the selection
   * 
   * **Requirements: 3.3, 3.4**
   */
  const handleTagSelection = useCallback((selection: TextSelection, type: AnnotationType) => {
    const input: CreateAnnotationInput = {
      type,
      text: selection.text,
      pageNumber: selection.pageNumber,
      boundingRect: {
        x: selection.boundingRect.x,
        y: selection.boundingRect.y,
        width: selection.boundingRect.width,
        height: selection.boundingRect.height,
      },
      source: 'manual',
    }
    
    const newAnnotation = addAnnotation(input)
    setSelectedAnnotationId(newAnnotation.id)
  }, [addAnnotation])

  /**
   * Handle annotation click - select and highlight
   */
  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    setSelectedAnnotationId(annotation.id)
    // Navigate to the annotation's page if different
    if (annotation.pageNumber !== currentPage) {
      setCurrentPage(annotation.pageNumber)
    }
  }, [currentPage])

  /**
   * Handle suggestion click - accept the suggestion
   * 
   * **Requirements: 5.3**
   */
  const handleSuggestionClick = useCallback((suggestion: Annotation) => {
    acceptSuggestion(suggestion.id)
    setSelectedAnnotationId(suggestion.id)
  }, [acceptSuggestion])

  /**
   * Handle annotation deletion
   * 
   * **Requirements: 4.2**
   */
  const handleDeleteAnnotation = useCallback((id: string) => {
    removeAnnotation(id)
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null)
    }
  }, [removeAnnotation, selectedAnnotationId])

  /**
   * Handle navigation to annotation from sidebar
   * 
   * **Requirements: 4.3**
   */
  const handleNavigateToAnnotation = useCallback((id: string) => {
    const annotation = annotations.find(a => a.id === id)
    if (annotation) {
      setSelectedAnnotationId(id)
      if (annotation.pageNumber !== currentPage) {
        setCurrentPage(annotation.pageNumber)
      }
    }
  }, [annotations, currentPage])

  /**
   * Handle Accept All suggestions
   * 
   * **Requirements: 5.4**
   */
  const handleAcceptAll = useCallback(() => {
    acceptAllSuggestions()
  }, [acceptAllSuggestions])

  /**
   * Handle Clear Suggestions
   * 
   * **Requirements: 5.5**
   */
  const handleClearSuggestions = useCallback(() => {
    clearSuggestions()
  }, [clearSuggestions])

  /**
   * Handle AI Suggest button click
   * Calls the AI suggestions API and displays results as pulsing highlights
   * 
   * **Requirements: 5.1, 5.2**
   */
  const handleAISuggest = useCallback(async () => {
    if (!documentContent) {
      toast({
        title: 'Error',
        description: 'No document content available for AI analysis',
        variant: 'destructive',
      })
      return
    }

    try {
      const newSuggestions = await fetchSuggestions(documentContent, documentName)
      setSuggestions(newSuggestions)
      
      if (newSuggestions.length === 0) {
        toast({
          title: 'No suggestions found',
          description: 'AI could not identify any sections or questions in this document.',
        })
      } else {
        toast({
          title: 'Suggestions ready',
          description: `Found ${newSuggestions.length} potential sections and questions. Click to accept or use "Accept All".`,
        })
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate AI suggestions',
        variant: 'destructive',
      })
    }
  }, [documentContent, documentName, fetchSuggestions, setSuggestions])

  /**
   * Handle Save and Continue button click
   * Saves annotations to database and navigates to questions page on success.
   * 
   * **Requirements: 6.1, 6.2, 6.3, 6.4**
   */
  const handleSave = useCallback(async () => {
    const state = getAnnotationState()
    
    // If custom onSave handler provided, use it
    if (onSave) {
      onSave(state)
      return
    }
    
    // Otherwise use the built-in save with navigation
    await saveAnnotationsToDb(projectId, state, documentName)
  }, [getAnnotationState, onSave, saveAnnotationsToDb, projectId, documentName])

  /**
   * Handle retry button click after save failure
   * 
   * **Requirements: 6.4**
   */
  const handleRetry = useCallback(async () => {
    await retrySave()
  }, [retrySave])

  /**
   * Handle Cancel button click
   */
  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  // Check if we have any annotations to save
  const hasAnnotations = annotations.length > 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <Toolbar
        mode={mode}
        documentName={documentName}
        hasAnnotations={hasAnnotations}
        isLoadingAISuggestions={isLoadingAISuggestions}
        isSaving={isSaving}
        saveError={saveError}
        onAISuggest={handleAISuggest}
        onSave={handleSave}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div ref={pdfViewerRef} className="flex-1 overflow-hidden relative">
          <PDFViewer
            pdfData={pdfSource}
            currentPage={currentPage}
            zoom={zoom}
            annotations={annotations}
            suggestions={suggestions}
            selectedAnnotationId={selectedAnnotationId}
            onTagSelection={handleTagSelection}
            onAnnotationClick={handleAnnotationClick}
            onSuggestionClick={handleSuggestionClick}
            onPageChange={setCurrentPage}
            onZoomChange={setZoom}
            onDocumentLoad={handleDocumentLoad}
            showContextMenu={true}
          />
          
          {/* AI Suggestions Loading Overlay */}
          {isLoadingAISuggestions && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-40 animate-in fade-in-50 duration-200">
              <div className="bg-card border rounded-lg shadow-lg p-6 flex flex-col items-center gap-4 max-w-sm mx-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                  <Sparkles className="h-10 w-10 text-purple-500 relative z-10 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Analyzing Document</p>
                  <p className="text-xs text-muted-foreground">
                    AI is identifying sections and questions...
                  </p>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {/* Saving Overlay */}
          {isSaving && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-40 animate-in fade-in-50 duration-200">
              <div className="bg-card border rounded-lg shadow-lg p-6 flex flex-col items-center gap-4 max-w-sm mx-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <Save className="h-10 w-10 text-primary relative z-10" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Saving Questions</p>
                  <p className="text-xs text-muted-foreground">
                    Your annotations are being saved to the project...
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Annotation Sidebar */}
        <div className="w-80 shrink-0">
          <AnnotationSidebar
            annotations={annotations}
            suggestions={suggestions}
            mode={mode}
            selectedAnnotationId={selectedAnnotationId}
            onDelete={handleDeleteAnnotation}
            onNavigate={handleNavigateToAnnotation}
            onAcceptAll={handleAcceptAll}
            onClearSuggestions={handleClearSuggestions}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Props for the Toolbar component
 */
interface ToolbarProps {
  mode: 'manual' | 'ai-assisted'
  documentName: string
  hasAnnotations: boolean
  isLoadingAISuggestions: boolean
  isSaving: boolean
  saveError: Error | null
  onAISuggest: () => void
  onSave: () => void
  onRetry: () => void
  onCancel: () => void
}

/**
 * Toolbar Component
 * 
 * Displays action buttons for the PDF annotator.
 * - AI Suggest button (AI-Assisted mode only)
 * - Save and Continue button
 * - Retry button (shown after save error)
 * - Cancel button
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 5.1, 6.1, 6.4**
 */
function Toolbar({
  mode,
  documentName,
  hasAnnotations,
  isLoadingAISuggestions,
  isSaving,
  saveError,
  onAISuggest,
  onSave,
  onRetry,
  onCancel,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
      {/* Left side - Document info */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium truncate max-w-[300px]" title={documentName}>
          {documentName}
        </h2>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full transition-colors",
          mode === 'ai-assisted' 
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        )}>
          {mode === 'ai-assisted' ? 'AI-Assisted' : 'Manual Selection'}
        </span>
        
        {/* Loading indicator for AI suggestions */}
        {isLoadingAISuggestions && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in-50 duration-200">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Analyzing document...</span>
          </div>
        )}
        
        {/* Saving indicator */}
        {isSaving && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in-50 duration-200">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving questions...</span>
          </div>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2">
        {/* AI Suggest button - only in AI-Assisted mode */}
        {mode === 'ai-assisted' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAISuggest}
            disabled={isLoadingAISuggestions || isSaving}
            className={cn(
              "gap-2 transition-all duration-200",
              isLoadingAISuggestions && "opacity-80"
            )}
          >
            {isLoadingAISuggestions ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="animate-pulse">Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI Suggest
              </>
            )}
          </Button>
        )}

        {/* Cancel button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="transition-opacity duration-200"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>

        {/* Retry button - shown after save error */}
        {saveError && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isSaving}
            className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950 animate-in fade-in-50 duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}

        {/* Save and Continue button */}
        <Button
          size="sm"
          onClick={onSave}
          disabled={!hasAnnotations || isSaving}
          className={cn(
            "gap-2 transition-all duration-200",
            isSaving && "opacity-80"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="animate-pulse">Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save and Continue
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default PDFAnnotator
