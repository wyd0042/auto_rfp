"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Save, Sparkles, Brain } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { AnswerDisplay } from "@/components/ui/answer-display"
import { SourcePanel } from "@/components/ui/source-panel"
import { ImprovementToolbar } from "@/components/ui/improvement-toolbar"
import { useSourcePanel } from "@/hooks/use-source-panel"
import { toast } from "@/components/ui/use-toast"
import { appendSourceContent } from "@/lib/utils/source-utils"
import { AnswerSource } from "@/types/api"

interface AnswerData {
  text: string;
  sources?: AnswerSource[];
}

interface QuestionEditorProps {
  question: any;
  section: any;
  answer: AnswerData | undefined;
  selectedIndexes: Set<string>;
  isUnsaved: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  useMultiStep: boolean;
  onAnswerChange: (value: string) => void;
  onSave: () => void;
  onGenerateAnswer: () => void;
  onSourceClick: (source: AnswerSource) => void;
  onMultiStepToggle: (enabled: boolean) => void;
}

export function QuestionEditor({
  question,
  section,
  answer,
  selectedIndexes,
  isUnsaved,
  isSaving,
  isGenerating,
  useMultiStep,
  onAnswerChange,
  onSave,
  onGenerateAnswer,
  onSourceClick,
  onMultiStepToggle
}: QuestionEditorProps) {
  // Use the source panel hook for state management with localStorage persistence
  const { isExpanded, toggle } = useSourcePanel();
  
  // Track selected source for visual highlighting
  const [selectedSourceId, setSelectedSourceId] = React.useState<number | undefined>(undefined);
  
  // Get sources from answer, default to empty array
  const sources = answer?.sources ?? [];
  
  /**
   * Handler for using source content - appends source text to current answer
   * Requirements: 5.2, 5.3
   */
  const handleUseContent = (source: AnswerSource) => {
    if (!source.textContent) return;
    
    const currentText = answer?.text || '';
    const newText = appendSourceContent(currentText, source.textContent);
    
    onAnswerChange(newText);
    
    // Show confirmation notification (Requirement 5.3)
    toast({
      title: "Content added",
      description: `Added content from "${source.fileName}" to your answer.`,
    });
  };
  
  /**
   * Handler for source selection - highlights source and opens details dialog
   * Requirements: 2.1, 2.2
   */
  const handleSourceClick = (source: AnswerSource) => {
    setSelectedSourceId(source.id);
    onSourceClick(source);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{section.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {question.question}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isUnsaved && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                Unsaved
              </Badge>
            )}
            <Badge variant="outline" className={answer?.text ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}>
              {answer?.text ? "Answered" : "Needs Answer"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Index warning */}
        {selectedIndexes.size === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-700">
              No project indexes selected - AI will use default responses
            </span>
          </div>
        )}

        <Textarea
          placeholder="Enter your answer here..."
          className="min-h-[200px]"
          value={answer?.text || ""}
          onChange={(e) => onAnswerChange(e.target.value)}
        />
        
        {/* Improvement Toolbar - AI-powered text improvement actions */}
        {/* Requirements: 1.2, 2.2, 3.2, 4.2, 5.1 */}
        <ImprovementToolbar
          text={answer?.text || ""}
          onImprove={(improvedText) => onAnswerChange(improvedText)}
          disabled={isGenerating}
        />
        
        {/* Show markdown preview if there's content */}
        {answer?.text && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Preview:</h3>
            <AnswerDisplay content={answer.text} />
          </div>
        )}
        
        {/* Source Panel - Collapsible panel showing all sources with relevance indicators */}
        {/* Requirements: 1.1, 1.2, 1.4, 3.1 */}
        <SourcePanel
          sources={sources}
          onSourceClick={handleSourceClick}
          onUseContent={handleUseContent}
          isExpanded={isExpanded}
          onToggle={toggle}
          selectedSourceId={selectedSourceId}
          questionText={question.question}
        />
        
        {/* Action area */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-3">
            {/* AI Generation Section */}
            <div className="flex items-center gap-2">
              <Button
                variant={useMultiStep ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={onGenerateAnswer}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Generating...
                  </>
                ) : (
                  <>
                    {useMultiStep ? <Brain className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {useMultiStep ? 'Reasoning Mode' : 'Generate'}
                  </>
                )}
              </Button>
              
              {/* Compact multi-step toggle */}
              <div className="flex items-center gap-1.5" title="Enable step-by-step reasoning">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <Switch 
                  checked={useMultiStep}
                  onCheckedChange={onMultiStepToggle}
                />
              </div>
            </div>

            {/* Index count badge */}
            {selectedIndexes.size > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedIndexes.size} project {selectedIndexes.size === 1 ? 'index' : 'indexes'}
              </Badge>
            )}
          </div>

          {/* Save Actions */}
          <div className="flex items-center gap-2">
            {isUnsaved && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Spinner className="h-4 w-4 mr-1" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 