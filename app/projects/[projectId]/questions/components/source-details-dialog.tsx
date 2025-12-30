"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AnswerSource } from "@/types/api"

interface SourceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: AnswerSource | null;
}

/**
 * Clean up text content by removing HTML tags and formatting nicely
 */
function cleanTextContent(text: string): string {
  if (!text) return '';
  
  // Replace common HTML table elements with readable formatting
  let cleaned = text
    // Handle table structure
    .replace(/<table[^>]*>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    .replace(/<thead[^>]*>/gi, '')
    .replace(/<\/thead>/gi, '')
    .replace(/<tbody[^>]*>/gi, '')
    .replace(/<\/tbody>/gi, '')
    .replace(/<tr[^>]*>/gi, '')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<th[^>]*>/gi, '| ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<td[^>]*>/gi, '| ')
    .replace(/<\/td>/gi, ' ')
    // Handle other common HTML elements
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<strong[^>]*>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<b[^>]*>/gi, '**')
    .replace(/<\/b>/gi, '**')
    .replace(/<em[^>]*>/gi, '_')
    .replace(/<\/em>/gi, '_')
    .replace(/<i[^>]*>/gi, '_')
    .replace(/<\/i>/gi, '_')
    // Remove any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  return cleaned;
}

export function SourceDetailsDialog({ isOpen, onClose, source }: SourceDetailsDialogProps) {
  const [isTextTabActive, setIsTextTabActive] = useState(true);
  
  // Clean the text content for display
  const cleanedTextContent = useMemo(() => {
    if (!source?.textContent) return '';
    return cleanTextContent(source.textContent);
  }, [source?.textContent]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <div className="flex justify-between items-center mb-2">
          <DialogTitle className="text-xl font-semibold">Source Information</DialogTitle>
        </div>
        <div className="text-sm text-gray-500 mb-4">Details about this source document</div>
        
        {source && (
          <div>
            {/* Tab Navigation */}
            <div className="flex border-b mb-4">
              <button
                className={`px-4 py-2 font-medium ${isTextTabActive ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setIsTextTabActive(true)}
              >
                Text Content
              </button>
              <button
                className={`px-4 py-2 font-medium ${!isTextTabActive ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setIsTextTabActive(false)}
              >
                Metadata
              </button>
            </div>
            
            {/* Text Content Tab */}
            {isTextTabActive ? (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Text:</h3>
                  <div className="text-sm text-gray-500">
                    {source.fileName} {source.pageNumber ? `- Page ${source.pageNumber}` : ''}
                  </div>
                </div>
                
                {source.textContent ? (
                  <ScrollArea className="h-72 w-full border rounded-md">
                    <div className="whitespace-pre-wrap text-sm p-4 bg-gray-50 leading-relaxed">
                      {cleanedTextContent}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-72 border rounded-md p-3 flex items-center justify-center text-gray-500 bg-gray-50">
                    No text content available for this source
                  </div>
                )}
              </div>
            ) : (
              /* Metadata Tab */
              <div className="space-y-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-gray-500">File Name</span>
                  <span className="font-medium">{source.fileName}</span>
                </div>
                
                {source.pageNumber && (
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-gray-500">Page Number</span>
                    <span>{source.pageNumber}</span>
                  </div>
                )}
                
                {source.relevance !== null && source.relevance !== undefined && (
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-gray-500">Relevance</span>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${source.relevance}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">{source.relevance}% match</span>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">
                    This source was used to generate the answer. You can view the full document in your project files.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 