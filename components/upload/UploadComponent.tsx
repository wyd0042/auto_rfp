"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/components/ui/use-toast";
import { LlamaParseResult } from "@/types/api";
import { DocumentViewer } from "@/components/upload/DocumentViewer";
import { FileList } from "@/components/upload/FileList";
import { UploadSection } from "@/components/upload/UploadSection";
import { ProcessingStatus } from "@/components/ProcessingModal";
import { useExtractionPreference } from "@/hooks/use-extraction-preference";
import { ExtractionMode } from "@/types/annotation";

/**
 * View state for the upload component
 * - 'upload': Initial file upload view
 * - 'annotate': PDF annotation view for manual/ai-assisted modes
 */
type ComponentView = 'upload' | 'annotate';

/**
 * Data needed for the PDF annotator view
 */
interface AnnotatorData {
  pdfData: ArrayBuffer;
  documentContent: string;
  documentName: string;
}

interface UploadComponentProps {
  projectId: string | null;
}

export function UploadComponent({ projectId }: UploadComponentProps) {
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<LlamaParseResult[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<LlamaParseResult | null>(null);
  const [viewingDocument, setViewingDocument] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("uploading");
  
  // Extraction mode state with localStorage persistence
  const { mode: extractionMode, setMode: setExtractionMode } = useExtractionPreference();
  
  // View state for switching between upload and annotator views
  const [currentView, setCurrentView] = useState<ComponentView>('upload');
  
  // Data for the PDF annotator (stored after file upload)
  const [annotatorData, setAnnotatorData] = useState<AnnotatorData | null>(null);
  
  // Store the original file for PDF data extraction
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  /**
   * Handle extraction mode change
   * Persists the preference to localStorage
   */
  const handleModeChange = useCallback((mode: ExtractionMode) => {
    setExtractionMode(mode);
  }, [setExtractionMode]);

  /**
   * Handle file selection - store the file for later use
   */
  const handleFileSelected = useCallback((file: File) => {
    setUploadedFile(file);
  }, []);

  /**
   * Handle Auto Extract mode - uses existing Gemini AI extraction flow
   */
  const handleAutoExtract = async (result: LlamaParseResult) => {
    // Add project ID to the result object for reference
    const resultWithProject: LlamaParseResult = {
      ...result,
      projectId: projectId || undefined
    };

    try {
      // Update status to parsing when starting AI processing
      setProcessingStatus("parsing");
      
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
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract questions');
      }

      // Update status to extracting when AI is processing
      setProcessingStatus("extracting");
      
      // Get the response data
      await extractResponse.json();
      
      // Mark as complete
      setProcessingStatus("complete");

      // Add to uploaded files
      setUploadedFiles(prev => [...prev, resultWithProject]);
      
      // Wait a moment to show completion state before redirecting
      setTimeout(() => {
        router.push(`/projects/${projectId}/questions`);
      }, 1000);
    } catch (error) {
      console.error('Error processing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to process document',
        variant: 'destructive',
      });
      setProcessingStatus("uploading");
    }
  };

  /**
   * Handle Manual/AI-Assisted modes - stores PDF data and switches to annotator view
   */
  const handleManualOrAIAssistedMode = async (result: LlamaParseResult, file: File) => {
    try {
      // Read the file as ArrayBuffer for PDF rendering
      const pdfData = await file.arrayBuffer();
      
      // Store the data for the annotator
      setAnnotatorData({
        pdfData,
        documentContent: result.content,
        documentName: result.documentName,
      });
      
      // Switch to annotator view
      setCurrentView('annotate');
      setProcessingStatus("uploading");
    } catch (error) {
      console.error('Error preparing PDF for annotation:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare document for annotation',
        variant: 'destructive',
      });
      setProcessingStatus("uploading");
    }
  };

  /**
   * Main file processed handler - routes to appropriate mode handler
   */
  const handleFileProcessed = async (result: LlamaParseResult) => {
    if (extractionMode === 'auto') {
      await handleAutoExtract(result);
    } else {
      // Manual or AI-Assisted mode - need the original file for PDF data
      if (uploadedFile) {
        // Check if the file is a PDF - only PDFs can use manual/AI-assisted modes
        const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();
        if (fileExtension !== 'pdf') {
          toast({
            title: 'Auto Extract Used',
            description: 'Manual and AI-Assisted modes are only available for PDF files. Using Auto Extract instead.',
          });
          await handleAutoExtract(result);
          return;
        }
        await handleManualOrAIAssistedMode(result, uploadedFile);
      } else {
        // Fallback to auto extract if file not available
        console.warn('Original file not available, falling back to auto extract');
        await handleAutoExtract(result);
      }
    }
  };

  // Update processing status from child components
  const updateProcessingStatus = (status: ProcessingStatus) => {
    setProcessingStatus(status);
  };

  // Handle document selection for viewing
  const handleViewDocument = (doc: LlamaParseResult) => {
    setSelectedDocument(doc);
    setViewingDocument(true);
  };

  // Handle back button click to return to file list
  const handleBackToList = () => {
    setViewingDocument(false);
  };

  /**
   * Handle cancel from PDF annotator - returns to upload view
   */
  const handleAnnotatorCancel = useCallback(() => {
    setCurrentView('upload');
    setAnnotatorData(null);
    setUploadedFile(null);
  }, []);

  // Show PDF annotator view for manual/ai-assisted modes
  if (currentView === 'annotate' && annotatorData && projectId) {
    // Dynamically import PDFAnnotator to avoid SSR issues
    const PDFAnnotator = React.lazy(() => 
      import('@/app/projects/[projectId]/questions/components/pdf-annotator/pdf-annotator').then(mod => ({ default: mod.PDFAnnotator }))
    );
    
    return (
      <React.Suspense fallback={<div className="flex items-center justify-center h-[80vh]">Loading PDF viewer...</div>}>
        <div className="w-full h-[85vh]">
          <PDFAnnotator
            projectId={projectId}
            pdfData={annotatorData.pdfData}
            documentContent={annotatorData.documentContent}
            documentName={annotatorData.documentName}
            mode={extractionMode === 'ai-assisted' ? 'ai-assisted' : 'manual'}
            onCancel={handleAnnotatorCancel}
          />
        </div>
        <Toaster />
      </React.Suspense>
    );
  }

  return (
    <>
      {viewingDocument && selectedDocument ? (
        <DocumentViewer 
          document={selectedDocument} 
          onBack={handleBackToList}
          updateProcessingStatus={updateProcessingStatus}
        />
      ) : (
        <>
          <UploadSection 
            onFileProcessed={handleFileProcessed}
            onFileSelected={handleFileSelected}
            processingStatus={processingStatus}
            updateProcessingStatus={updateProcessingStatus}
            extractionMode={extractionMode}
            onModeChange={handleModeChange}
          />
          <FileList files={uploadedFiles} onViewDocument={handleViewDocument} />
        </>
      )}
      
      <Toaster />
    </>
  );
} 