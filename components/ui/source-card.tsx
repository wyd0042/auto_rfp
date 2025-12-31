"use client"

import { FileText, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getRelevanceColor, type RelevanceColor } from "@/lib/utils/source-utils"
import type { AnswerSource } from "@/types/api"

interface SourceCardProps {
  source: AnswerSource;
  isSelected: boolean;
  onSelect: () => void;
  onUseContent: () => void;
}

/**
 * Maps relevance color to Tailwind CSS classes
 */
function getColorClasses(color: RelevanceColor): {
  bg: string;
  text: string;
  border: string;
  progress: string;
} {
  switch (color) {
    case 'green':
      return {
        bg: 'bg-green-50 dark:bg-green-950/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
        progress: 'bg-green-500',
      };
    case 'amber':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        progress: 'bg-amber-500',
      };
    case 'red':
      return {
        bg: 'bg-red-50 dark:bg-red-950/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        progress: 'bg-red-500',
      };
  }
}

/**
 * Checks if the source has usable text content
 */
export function hasUsableContent(source: AnswerSource): boolean {
  return source.textContent !== null && 
         source.textContent !== undefined && 
         source.textContent.trim() !== '';
}

/**
 * SourceCard Component
 * 
 * Displays individual source information including file name, relevance score
 * with color indicator, and a text preview. Includes a "Use" button to append
 * content to the answer.
 * 
 * Requirements: 1.3, 2.1, 4.1, 5.1, 5.4
 */
export function SourceCard({ source, isSelected, onSelect, onUseContent }: SourceCardProps) {
  const relevanceColor = getRelevanceColor(source.relevance);
  const colorClasses = getColorClasses(relevanceColor);
  const canUseContent = hasUsableContent(source);
  const relevanceValue = source.relevance ?? 0;
  
  // Truncate text preview to ~100 characters
  const textPreview = source.textContent 
    ? source.textContent.slice(0, 100) + (source.textContent.length > 100 ? '...' : '')
    : 'No text content available';

  const handleUseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canUseContent) {
      onUseContent();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all bg-white dark:bg-slate-950",
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400/50",
        isSelected 
          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400/30 shadow-sm" 
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      )}
    >
      {/* Header: File name and Use button */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="font-medium text-sm truncate text-slate-700 dark:text-slate-300" title={source.fileName}>
            {source.fileName}
          </span>
          {source.pageNumber && (
            <Badge variant="outline" className="text-xs flex-shrink-0 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              p.{source.pageNumber}
            </Badge>
          )}
        </div>
        
        {canUseContent ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseClick}
            className="flex-shrink-0 h-7 px-2 text-xs bg-white dark:bg-slate-900 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
          >
            <Copy className="h-3 w-3 mr-1" />
            Use
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="flex-shrink-0 h-7 px-2 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Use
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              No text content available to use
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Relevance indicator */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Relevance</span>
          <span className={cn("text-xs font-semibold", colorClasses.text)}>
            {source.relevance !== null && source.relevance !== undefined 
              ? `${source.relevance}%` 
              : 'N/A'}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
          <div 
            className={cn("h-1.5 rounded-full transition-all", colorClasses.progress)}
            style={{ width: `${relevanceValue}%` }}
          />
        </div>
      </div>

      {/* Text preview */}
      <p className={cn(
        "text-xs line-clamp-2",
        source.textContent ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500 italic"
      )}>
        {textPreview}
      </p>
    </div>
  );
}
