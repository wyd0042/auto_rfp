import React from "react";
import { FileUploader } from "@/components/FileUploader";
import { LlamaParseResult } from "@/types/api";
import { ProcessingStatus } from "@/components/ProcessingModal";
import { ExtractionModeSelector } from "@/app/projects/[projectId]/questions/components/extraction-mode-selector";
import { ExtractionMode } from "@/types/annotation";

interface UploadSectionProps {
  onFileProcessed: (result: LlamaParseResult) => void;
  onFileSelected?: (file: File) => void;
  processingStatus?: ProcessingStatus;
  updateProcessingStatus?: (status: ProcessingStatus) => void;
  extractionMode?: ExtractionMode;
  onModeChange?: (mode: ExtractionMode) => void;
}

export function UploadSection({ 
  onFileProcessed,
  onFileSelected,
  processingStatus, 
  updateProcessingStatus,
  extractionMode = 'auto',
  onModeChange,
}: UploadSectionProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col items-center space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Welcome to AutoRFP</p>
          <h2 className="text-2xl font-semibold">Get started by adding sections to the project.</h2>
        </div>
        
        {/* Extraction Mode Selector */}
        {onModeChange && (
          <div className="w-full max-w-2xl">
            <ExtractionModeSelector
              selectedMode={extractionMode}
              onModeChange={onModeChange}
            />
          </div>
        )}
        
        {/* Upload Section */}
        <div className="w-full max-w-2xl">
          <FileUploader 
            onFileProcessed={onFileProcessed}
            onFileSelected={onFileSelected}
            processingStatus={processingStatus}
            updateProcessingStatus={updateProcessingStatus}
          />
        </div>
      </div>
    </div>
  );
} 