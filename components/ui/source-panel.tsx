"use client"

import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SourceCard } from "@/components/ui/source-card"
import { NoSourceWarning } from "@/components/ui/no-source-warning"
import { sortSourcesByRelevance } from "@/lib/utils/source-utils"
import { cn } from "@/lib/utils"
import type { AnswerSource } from "@/types/api"

export interface SourcePanelProps {
  sources: AnswerSource[];
  onSourceClick: (source: AnswerSource) => void;
  onUseContent: (source: AnswerSource) => void;
  isExpanded: boolean;
  onToggle: () => void;
  selectedSourceId?: number;
  questionText?: string;
  className?: string;
}

/**
 * SourcePanel Component
 * 
 * A collapsible panel that displays all available sources for a question's answer.
 * Shows source count in header, renders SourceCard for each source (sorted by relevance),
 * and displays NoSourceWarning when no sources are available.
 * 
 * Requirements: 1.1, 1.2, 1.4, 3.1
 */
export function SourcePanel({
  sources,
  onSourceClick,
  onUseContent,
  isExpanded,
  onToggle,
  selectedSourceId,
  questionText,
  className,
}: SourcePanelProps) {
  const sourceCount = sources.length;
  const sortedSources = sortSourcesByRelevance(sources);
  const hasNoSources = sourceCount === 0;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggle}
      className={cn("border rounded-lg bg-card", className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Sources</span>
          </div>
          <Badge 
            variant={hasNoSources ? "destructive" : "secondary"}
            className="ml-2"
          >
            {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
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
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Utility function to get the source count from a SourcePanel
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
