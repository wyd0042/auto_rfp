"use client"

import React, { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileUploader } from "@/components/FileUploader"
import { LlamaParseResult } from "@/types/api"
import { ProcessingStatus } from "@/components/ProcessingModal"
import { toast } from "@/components/ui/use-toast"
import { ExtractionModeSelector } from "./extraction-mode-selector"
import { PDFAnnotator } from "./pdf-annotator/pdf-annotator"
import { useExtractionPreference } from "@/hooks/use-extraction-preference"
import type { ExtractionMode } from "@/types/annotation"

/**
 * View state for the upload dialog
 * - 'upload': Initial file upload view
 * - 'annotate': PDF annotation view for manual/ai-assisted modes
 */
type DialogView = 'upload' | 'annotate'

/**
 * Data needed for the PDF annotator view
 */
interface AnnotatorData {
  pdfData: ArrayBuffer
  documentContent: string
  documentName: string
}

interface UploadDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onUploadComplete: () => void
}

/**
 * Enhanced Upload Dialog with Extraction Mode Selection
 * 
 * Supports three extraction modes:
 * - Auto Extract: Uses existing Gemini AI extraction
 * - Manual Selection: Shows PDF viewer for manual text selection
 * - AI-Assisted: Shows PDF viewer with AI suggestions for validation
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 1.1, 1.2, 1.3, 1.4, 2.1**
 */
export function UploadDialog({ isOpen, onClose, projectId, onUploadComplete }: UploadDialogProps) {
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("uploading")
  
  // Extraction mode state with localStorage persistence
  const { mode: extractionMode, setMode: setExtractionMode } = useExtractionPreference()
  
  // View state for switching between upload and annotator views
  const [currentView, setCurrentView] = useState<DialogView>('upload')
  
  // Data for the PDF annotator (stored after file upload)
  const [annotatorData, setAnnotatorData] = useState<AnnotatorData | null>(null)
  
  // Store the original file for PDF data extraction
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  /**
   * Handle extraction mode change
   * Persists the preference to localStorage
   * 
   * **Requirements: 1.1, 7.1**
   */
  const handleModeChange = useCallback((mode: ExtractionMode) => {
    setExtractionMode(mode)
  }, [setExtractionMode])

  /**
   * Handle file processed for Auto Extract mode
   * Uses existing Gemini AI extraction flow
   * 
   * **Requirements: 1.2**
   */
  const handleAutoExtract = async (result: LlamaParseResult) => {
    try {
      // Update status to parsing when starting OpenAI processing
      setProcessingStatus("parsing")
      
      // Store the questions in the database
      const extractResponse = await fetch('/api/extract-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: result.documentId,
          documentName: result.documentName,
          content: result.content,
          projectId,
        }),
      })

      if (!extractResponse.ok) {
        throw new Error('Failed to extract questions')
      }

      // Update status to extracting when OpenAI is processing
      setProcessingStatus("extracting")
      
      // Get the response data
      await extractResponse.json()
      
      // Mark as complete
      setProcessingStatus("complete")

      // Show success toast
      toast({
        title: "Success",
        description: "Document uploaded and questions extracted successfully!",
      })
      
      // Wait a moment to show completion state before closing
      setTimeout(() => {
        handleDialogClose()
        onUploadComplete() // Refresh the questions data
      }, 1500)
    } catch (error) {
      console.error('Error processing document:', error)
      toast({
        title: 'Error',
        description: 'Failed to process document',
        variant: 'destructive',
      })
      setProcessingStatus("uploading") // Reset status on error
    }
  }

  /**
   * Handle file processed for Manual/AI-Assisted modes
   * Stores PDF data and switches to annotator view
   * 
   * **Requirements: 1.3, 1.4, 2.1**
   */
  const handleManualOrAIAssistedMode = async (result: LlamaParseResult, file: File) => {
    try {
      // Read the file as ArrayBuffer for PDF rendering
      const pdfData = await file.arrayBuffer()
      
      // Store the data for the annotator
      setAnnotatorData({
        pdfData,
        documentContent: result.content,
        documentName: result.documentName,
      })
      
      // Switch to annotator view
      setCurrentView('annotate')
      setProcessingStatus("uploading") // Reset for next upload
    } catch (error) {
      console.error('Error preparing PDF for annotation:', error)
      toast({
        title: 'Error',
        description: 'Failed to prepare document for annotation',
        variant: 'destructive',
      })
      setProcessingStatus("uploading")
    }
  }

  /**
   * Main file processed handler - routes to appropriate mode handler
   * 
   * **Requirements: 1.2, 1.3, 1.4**
   */
  const handleFileProcessed = async (result: LlamaParseResult) => {
    if (extractionMode === 'auto') {
      // Auto Extract mode - use existing flow
      await handleAutoExtract(result)
    } else {
      // Manual or AI-Assisted mode - need the original file for PDF data
      if (uploadedFile) {
        // Check if the file is a PDF - only PDFs can use manual/AI-assisted modes
        const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase()
        if (fileExtension !== 'pdf') {
          toast({
            title: 'Auto Extract Used',
            description: 'Manual and AI-Assisted modes are only available for PDF files. Using Auto Extract instead.',
          })
          await handleAutoExtract(result)
          return
        }
        await handleManualOrAIAssistedMode(result, uploadedFile)
      } else {
        // Fallback to auto extract if file not available
        console.warn('Original file not available, falling back to auto extract')
        await handleAutoExtract(result)
      }
    }
  }

  /**
   * Handle file selection - store the file for later use
   */
  const handleFileSelected = useCallback((file: File) => {
    setUploadedFile(file)
  }, [])

  /**
   * Handle cancel from PDF annotator
   * Returns to upload view
   */
  const handleAnnotatorCancel = useCallback(() => {
    setCurrentView('upload')
    setAnnotatorData(null)
    setUploadedFile(null)
  }, [])

  /**
   * Reset dialog state
   */
  const resetDialogState = useCallback(() => {
    setProcessingStatus("uploading")
    setCurrentView('upload')
    setAnnotatorData(null)
    setUploadedFile(null)
  }, [])

  /**
   * Handle dialog close
   */
  const handleDialogClose = useCallback(() => {
    // Only allow closing if not currently processing
    if (processingStatus === "uploading" || processingStatus === "complete") {
      onClose()
      resetDialogState()
    }
  }, [processingStatus, onClose, resetDialogState])

  const handleClose = () => {
    handleDialogClose()
  }

  // Determine dialog size based on current view
  const dialogClassName = currentView === 'annotate' 
    ? "max-w-[95vw] max-h-[95vh] w-full h-[90vh]" 
    : "max-w-2xl max-h-[80vh] overflow-y-auto"

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={dialogClassName}>
        {currentView === 'upload' ? (
          // Upload View
          <>
            <DialogHeader>
              <DialogTitle>Upload Documents</DialogTitle>
              <DialogDescription>
                Choose how to extract questions from your document, then upload to begin.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-6">
              {/* Extraction Mode Selector - Requirements: 1.1 */}
              <ExtractionModeSelector
                selectedMode={extractionMode}
                onModeChange={handleModeChange}
              />
              
              {/* File Uploader */}
              <FileUploader 
                onFileProcessed={handleFileProcessed}
                onFileSelected={handleFileSelected}
                processingStatus={processingStatus}
                updateProcessingStatus={setProcessingStatus}
              />
            </div>
          </>
        ) : (
          // Annotator View - Requirements: 1.3, 1.4
          annotatorData && (
            <div className="flex flex-col h-full -m-6">
              <PDFAnnotator
                projectId={projectId}
                pdfData={annotatorData.pdfData}
                documentContent={annotatorData.documentContent}
                documentName={annotatorData.documentName}
                mode={extractionMode === 'ai-assisted' ? 'ai-assisted' : 'manual'}
                onCancel={handleAnnotatorCancel}
              />
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
} 