"use client"

import { FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SourceCard } from "@/components/ui/source-card"
import { NoSourceWarning } from "@/components/ui/no-source-warning"
import { sortSourcesByRelevance } from "@/lib/utils/source-utils"
import { cn } from "@/lib/utils"
import type { AnswerSource } from "@/types/api"

export interface SourceSidePanelProps {
  sources: AnswerSource[];
  onSourceClick: (source: AnswerSource) => void;
  onUseContent: (source: AnswerSource) => void;
  selectedSourceId?: number;
  questionText?: string;
  className?: string;
}

/**
 * SourceSidePanel Component
 * 
 * A non-collapsible panel designed for the right sidebar that displays all available
 * sources for a question's answer. Shows source count in a fixed header, renders
 * SourceCard for each source (sorted by relevance), and displays NoSourceWarning
 * when no sources are available.
 * 
 * Requirements: 2.1, 2.2, 2.3
 */
export function SourceSidePanel({
  sources,
  onSourceClick,
  onUseContent,
  selectedSourceId,
  questionText,
  className,
}: SourceSidePanelProps) {
  const sourceCount = sources.length;
  const sortedSources = sortSourcesByRelevance(sources);
  const hasNoSources = sourceCount === 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Fixed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 rounded-t-xl">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Sources</span>
        </div>
        <Badge 
          variant={hasNoSources ? "destructive" : "secondary"}
          className={hasNoSources 
            ? "bg-red-100 text-red-700 border-red-200" 
            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          }
        >
          {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        </Badge>
      </div>
      
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {hasNoSources ? (
          <NoSourceWarning questionText={questionText} />
        ) : (
          sortedSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              isSelected={selectedSourceId === source.id}
              onSelect={() => onSourceClick(source)}
              onUseContent={() => onUseContent(source)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Utility function to get the source count from a SourceSidePanel
 * Exported for testing purposes
 */
export function getSourceCount(sources: AnswerSource[]): number {
  return sources.length;
}

/**
 * Utility function to check if NoSourceWarning should be displayed
 * Exported for testing purposes
 */
export function shouldShowNoSourceWarning(sources: AnswerSource[]): boolean {
  return sources.length === 0;
}
