"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Annotation, TextSelection, AnnotationType } from '@/types/annotation'
import { SelectionContextMenu } from './selection-context-menu'
import { AnnotationHighlightList } from './annotation-highlight'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

/**
 * Props for the PDFViewer component
 */
export interface PDFViewerProps {
  /** PDF data as ArrayBuffer or URL string */
  pdfData: ArrayBuffer | string
  /** Current page number (1-indexed) */
  currentPage: number
  /** Zoom level (1.0 = 100%) */
  zoom: number
  /** List of permanent annotations to display */
  annotations: Annotation[]
  /** List of AI suggestions to display with pulsing animation */
  suggestions: Annotation[]
  /** ID of the currently selected annotation (if any) */
  selectedAnnotationId?: string | null
  /** Callback when user selects text */
  onTextSelect?: (selection: TextSelection) => void
  /** Callback when user tags a selection as section or question */
  onTagSelection?: (selection: TextSelection, type: AnnotationType) => void
  /** Callback when user clicks on an annotation */
  onAnnotationClick?: (annotation: Annotation) => void
  /** Callback when user clicks on a suggestion */
  onSuggestionClick?: (suggestion: Annotation) => void
  /** Callback when page changes */
  onPageChange?: (page: number) => void
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void
  /** Callback when document loads successfully */
  onDocumentLoad?: (numPages: number) => void
  /** Callback when document fails to load */
  onDocumentError?: (error: Error) => void
  /** Whether to show the context menu on text selection (default: true) */
  showContextMenu?: boolean
}

/**
 * Loading state component for PDF
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 2.1 - Loading spinner during PDF load**
 */
function PDFLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in-50 duration-300">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Loading PDF document...</p>
        <p className="text-xs text-muted-foreground">This may take a moment for large files</p>
      </div>
    </div>
  )
}

/**
 * Error state component for PDF loading failures
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 2.4 - Error handling with retry option**
 */
function PDFErrorState({ 
  error, 
  onRetry 
}: { 
  error: string
  onRetry?: () => void 
}) {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in-50 duration-300">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-destructive">Failed to load PDF</p>
        <p className="text-xs text-muted-foreground max-w-md">{error}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Try Again
        </Button>
      )}
    </div>
  )
}


/**
 * Zoom level presets
 */
const ZOOM_PRESETS = {
  MIN: 0.5,
  MAX: 3.0,
  STEP: 0.25,
  DEFAULT: 1.0,
  FIT_WIDTH: 'fit-width' as const,
}

/**
 * PDFViewer Component
 * 
 * Renders a PDF document with text selection capabilities using react-pdf.
 * Supports page navigation, zoom controls, and text selection for annotations.
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 2.1, 2.2, 2.3, 2.4, 3.1**
 */
export function PDFViewer({
  pdfData,
  currentPage,
  zoom,
  annotations,
  suggestions,
  selectedAnnotationId,
  onTextSelect,
  onTagSelection,
  onAnnotationClick,
  onSuggestionClick,
  onPageChange,
  onZoomChange,
  onDocumentLoad,
  onDocumentError,
  showContextMenu = true,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageInputValue, setPageInputValue] = useState(String(currentPage))
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  
  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [currentSelection, setCurrentSelection] = useState<TextSelection | null>(null)

  // Update page input when currentPage prop changes
  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  /**
   * Handle successful document load
   */
  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setError(null)
    onDocumentLoad?.(numPages)
  }, [onDocumentLoad])

  /**
   * Handle document load error
   */
  const handleDocumentLoadError = useCallback((err: Error) => {
    setIsLoading(false)
    setError(err.message || 'Failed to load PDF document')
    onDocumentError?.(err)
  }, [onDocumentError])

  /**
   * Navigate to previous page
   */
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1)
    }
  }, [currentPage, onPageChange])

  /**
   * Navigate to next page
   */
  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      onPageChange?.(currentPage + 1)
    }
  }, [currentPage, numPages, onPageChange])

  /**
   * Handle page input change
   */
  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value)
  }, [])

  /**
   * Handle page input submit
   */
  const handlePageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const pageNum = parseInt(pageInputValue, 10)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      onPageChange?.(pageNum)
    } else {
      setPageInputValue(String(currentPage))
    }
  }, [pageInputValue, numPages, currentPage, onPageChange])

  /**
   * Zoom in
   */
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + ZOOM_PRESETS.STEP, ZOOM_PRESETS.MAX)
    onZoomChange?.(newZoom)
  }, [zoom, onZoomChange])

  /**
   * Zoom out
   */
  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - ZOOM_PRESETS.STEP, ZOOM_PRESETS.MIN)
    onZoomChange?.(newZoom)
  }, [zoom, onZoomChange])

  /**
   * Fit to width
   */
  const handleFitToWidth = useCallback(() => {
    if (containerRef.current && pageRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48 // Account for padding
      const pageWidth = 612 // Standard PDF page width in points
      const newZoom = containerWidth / pageWidth
      onZoomChange?.(Math.min(Math.max(newZoom, ZOOM_PRESETS.MIN), ZOOM_PRESETS.MAX))
    }
  }, [onZoomChange])


  /**
   * Handle text selection from the PDF text layer
   * Captures text selection events, extracts selection data, and triggers callback
   * Shows context menu for tagging the selection
   * 
   * **Feature: hybrid-question-selection**
   * **Requirements: 3.1 - WHEN a user selects text in the PDF_Viewer THEN the 
   * Question_Selection_System SHALL highlight the selected text visually
   * Requirements: 3.2 - WHEN text is selected THEN the Question_Selection_System 
   * SHALL display a context menu with options to tag as Section or Question**
   */
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    
    // Early return if no valid selection
    if (!selection || selection.isCollapsed) {
      return
    }

    const selectedText = selection.toString().trim()
    
    // Ignore empty or whitespace-only selections
    if (!selectedText) {
      return
    }

    // Ensure we have at least one range
    if (selection.rangeCount === 0) {
      return
    }

    // Get the selection range
    const range = selection.getRangeAt(0)
    
    // Verify the selection is within the PDF text layer
    // by checking if the selection's common ancestor is within our container
    const commonAncestor = range.commonAncestorContainer
    const isWithinPdfContainer = containerRef.current?.contains(commonAncestor)
    
    if (!isWithinPdfContainer) {
      return
    }

    // Get the bounding rectangle of the selection
    const rect = range.getBoundingClientRect()

    // Create TextSelection object with all required data
    const textSelection: TextSelection = {
      text: selectedText,
      pageNumber: currentPage,
      boundingRect: rect,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    }

    // Store the current selection for context menu actions
    setCurrentSelection(textSelection)

    // Trigger the callback with selection data
    onTextSelect?.(textSelection)

    // Show context menu if enabled
    if (showContextMenu) {
      // Position the context menu near the selection
      // Use the end of the selection rectangle for positioning
      setContextMenuPosition({
        x: rect.right + 8,
        y: rect.top,
      })
      setContextMenuOpen(true)
    }
  }, [currentPage, onTextSelect, showContextMenu])

  /**
   * Handle mouse up event for text selection
   * Uses a small delay to ensure the browser has completed the selection
   * 
   * **Feature: hybrid-question-selection**
   * **Requirements: 3.1**
   */
  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    // Only process left mouse button releases
    if (event.button !== 0) {
      return
    }
    
    // Small delay to ensure selection is complete before processing
    // This allows the browser to finalize the selection state
    setTimeout(handleTextSelection, 10)
  }, [handleTextSelection])

  /**
   * Retry loading the document
   */
  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setError(null)
  }, [])

  /**
   * Close the context menu
   */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuOpen(false)
    setCurrentSelection(null)
    // Clear the browser selection
    window.getSelection()?.removeAllRanges()
  }, [])

  /**
   * Handle tagging selection as a section
   * 
   * **Feature: hybrid-question-selection**
   * **Requirements: 3.3 - WHEN a user tags selected text as a Section THEN the 
   * Question_Selection_System SHALL add the Annotation to the Annotation_State 
   * with a blue highlight**
   */
  const handleTagAsSection = useCallback(() => {
    if (currentSelection) {
      onTagSelection?.(currentSelection, 'section')
    }
    handleCloseContextMenu()
  }, [currentSelection, onTagSelection, handleCloseContextMenu])

  /**
   * Handle tagging selection as a question
   * 
   * **Feature: hybrid-question-selection**
   * **Requirements: 3.4 - WHEN a user tags selected text as a Question THEN the 
   * Question_Selection_System SHALL add the Annotation to the Annotation_State 
   * with a yellow highlight**
   */
  const handleTagAsQuestion = useCallback(() => {
    if (currentSelection) {
      onTagSelection?.(currentSelection, 'question')
    }
    handleCloseContextMenu()
  }, [currentSelection, onTagSelection, handleCloseContextMenu])

  // Prepare PDF source
  const pdfSource = typeof pdfData === 'string' 
    ? pdfData 
    : { data: pdfData }

  // Get annotations for current page
  const pageAnnotations = annotations.filter(a => a.pageNumber === currentPage)
  const pageSuggestions = suggestions.filter(s => s.pageNumber === currentPage)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-3 border-b bg-muted/30">
        {/* Page Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1 || isLoading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <Input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              className="w-12 h-8 text-center text-sm"
              disabled={isLoading}
              aria-label="Current page"
            />
            <span className="text-sm text-muted-foreground">
              / {numPages || '—'}
            </span>
          </form>
          
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextPage}
            disabled={currentPage >= numPages || isLoading}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_PRESETS.MIN || isLoading}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_PRESETS.MAX || isLoading}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleFitToWidth}
            disabled={isLoading}
            aria-label="Fit to width"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>


      {/* PDF Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/20"
        onMouseUp={handleMouseUp}
      >
        {error ? (
          <PDFErrorState error={error} onRetry={handleRetry} />
        ) : (
          <div className="flex justify-center p-6">
            <Document
              file={pdfSource}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={<PDFLoadingState />}
              className="shadow-lg"
            >
              <div ref={pageRef} className="relative">
                <Page
                  pageNumber={currentPage}
                  scale={zoom}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="bg-white"
                  loading={
                    <div className="flex flex-col items-center justify-center h-96 gap-3 animate-in fade-in-50 duration-200">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Loading page {currentPage}...</p>
                    </div>
                  }
                />
                
                {/* Annotation Highlights Overlay - using AnnotationHighlightList component */}
                <AnnotationHighlightList
                  annotations={pageAnnotations}
                  suggestions={pageSuggestions}
                  zoom={zoom}
                  selectedAnnotationId={selectedAnnotationId}
                  onAnnotationClick={onAnnotationClick}
                  onSuggestionClick={onSuggestionClick}
                />
              </div>
            </Document>
          </div>
        )}
      </div>

      {/* Selection Context Menu */}
      {showContextMenu && (
        <SelectionContextMenu
          position={contextMenuPosition}
          onTagAsSection={handleTagAsSection}
          onTagAsQuestion={handleTagAsQuestion}
          onClose={handleCloseContextMenu}
          isOpen={contextMenuOpen}
        />
      )}
    </div>
  )
}

export default PDFViewer
