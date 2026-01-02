"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Save, Sparkles, Brain } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { AnswerDisplay } from "@/components/ui/answer-display"
import { ImprovementToolbar } from "@/components/ui/improvement-toolbar"
import { AnswerSource } from "@/types/api"
import { AssigneeBadge, AssigneeInfo } from "./assignee-badge"
import { AssigneeDropdown, OrganizationMember } from "./assignee-dropdown"

interface AnswerData {
  text: string;
  sources?: AnswerSource[];
}

/**
 * Extracts the question text that will be displayed in the QuestionEditor header.
 * Used for property-based testing to verify question text display correctness.
 * 
 * @param question - The question object containing the question text
 * @returns The question text string that will be displayed, or empty string if invalid
 */
export function getDisplayedQuestionText(question: { question?: string } | null | undefined): string {
  if (!question || typeof question.question !== 'string') {
    return '';
  }
  return question.question;
}

/**
 * Determines whether the unsaved indicator badge should be visible in the QuestionEditor header.
 * Used for property-based testing to verify unsaved indicator visibility correctness.
 * 
 * @param isUnsaved - Boolean indicating whether there are unsaved changes
 * @returns true if the unsaved indicator should be displayed, false otherwise
 */
export function shouldShowUnsavedIndicator(isUnsaved: boolean): boolean {
  return isUnsaved === true;
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
  onMultiStepToggle: (enabled: boolean) => void;
  // Assignment props
  assignee?: AssigneeInfo | null;
  organizationMembers?: OrganizationMember[];
  canAssign?: boolean;
  onAssign?: (userId: string | null) => Promise<void>;
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
  onMultiStepToggle,
  assignee,
  organizationMembers = [],
  canAssign = false,
  onAssign,
}: QuestionEditorProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-200 truncate">{section.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {question.question}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Assignee Badge */}
            <AssigneeBadge assignee={assignee ?? null} showTooltip={true} />
            
            {isUnsaved && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Unsaved
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={answer?.text 
                ? "bg-green-50 text-green-700 border-green-200" 
                : "bg-yellow-50 text-yellow-700 border-yellow-200"
              }
            >
              {answer?.text ? "Answered" : "Needs Answer"}
            </Badge>
          </div>
        </div>
        
        {/* Assignment Dropdown - only shown for admin/owner users */}
        {canAssign && onAssign && (
          <div className="mt-3 flex items-center gap-2">
            <AssigneeDropdown
              questionId={question.id}
              currentAssignee={assignee ?? null}
              organizationMembers={organizationMembers}
              onAssign={onAssign}
              disabled={isSaving || isGenerating}
            />
          </div>
        )}
      </div>

      {/* Index warning */}
      {selectedIndexes.size === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-700">
            No project indexes selected - AI will use default responses
          </span>
        </div>
      )}

      {/* Answer textarea */}
      <Textarea
        placeholder="Enter your answer here..."
        className="min-h-[180px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-blue-400"
        value={answer?.text || ""}
        onChange={(e) => onAnswerChange(e.target.value)}
      />
      
      {/* Improvement Toolbar */}
      <ImprovementToolbar
        text={answer?.text || ""}
        onImprove={(improvedText) => onAnswerChange(improvedText)}
        disabled={isGenerating}
      />
      
      {/* Preview */}
      {answer?.text && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Preview</h3>
          <AnswerDisplay content={answer.text} />
        </div>
      )}
      
      {/* Action area */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
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
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800" title="Enable step-by-step reasoning">
              <Brain className="h-4 w-4 text-slate-500" />
              <Switch 
                checked={useMultiStep}
                onCheckedChange={onMultiStepToggle}
              />
            </div>
          </div>

          {/* Index count badge */}
          {selectedIndexes.size > 0 && (
            <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-800">
              {selectedIndexes.size} project {selectedIndexes.size === 1 ? 'index' : 'indexes'}
            </Badge>
          )}
        </div>

        {/* Save Actions */}
        <div className="flex items-center gap-2">
          {isUnsaved && (
            <Button 
              variant="default" 
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
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
    </div>
  );
} 