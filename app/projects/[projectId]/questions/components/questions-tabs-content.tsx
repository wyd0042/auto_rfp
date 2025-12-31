"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { QuestionsFilter } from "./questions-filter"
import { QuestionEditor } from "./question-editor"
import { QuestionNavigator } from "../../../components/question-navigator"
import { AISuggestionsPanel } from "../../../components/ai-suggestions-panel"
import { SourceSidePanel } from "@/components/ui/source-side-panel"
import { AnswerSource } from "@/types/api"

/**
 * Layout configuration for the three-panel structure.
 * Used for property-based testing to verify layout correctness.
 */
export interface PanelLayoutConfig {
  panelCount: number;
  panels: {
    name: 'navigator' | 'editor' | 'source';
    colSpan: number;
    order: number;
  }[];
  totalColumns: number;
}

/**
 * Returns the three-panel layout configuration.
 * This function is used for property-based testing to verify that
 * the layout structure is correct.
 * 
 * @returns PanelLayoutConfig - The layout configuration with panel details
 */
export function getThreePanelLayoutConfig(): PanelLayoutConfig {
  return {
    panelCount: 3,
    panels: [
      { name: 'navigator', colSpan: 3, order: 0 },
      { name: 'editor', colSpan: 5, order: 1 },
      { name: 'source', colSpan: 4, order: 2 },
    ],
    totalColumns: 12,
  };
}

/**
 * Validates that the layout configuration represents a valid three-panel structure.
 * 
 * @param config - The layout configuration to validate
 * @returns boolean - True if the configuration is valid
 */
export function isValidThreePanelLayout(config: PanelLayoutConfig): boolean {
  // Must have exactly 3 panels
  if (config.panelCount !== 3 || config.panels.length !== 3) {
    return false;
  }

  // Panels must be in correct order: navigator (0), editor (1), source (2)
  const expectedOrder = ['navigator', 'editor', 'source'];
  for (let i = 0; i < config.panels.length; i++) {
    if (config.panels[i].name !== expectedOrder[i] || config.panels[i].order !== i) {
      return false;
    }
  }

  // Column spans must sum to total columns
  const totalSpan = config.panels.reduce((sum, panel) => sum + panel.colSpan, 0);
  if (totalSpan !== config.totalColumns) {
    return false;
  }

  // Each panel must have positive column span
  if (config.panels.some(panel => panel.colSpan <= 0)) {
    return false;
  }

  return true;
}

interface AnswerData {
  text: string;
  sources?: AnswerSource[];
}

interface QuestionWithSection {
  id: string;
  question: string;
  sectionTitle: string;
  sectionId: string;
}

interface QuestionsTabsContentProps {
  questions: QuestionWithSection[];
  selectedQuestion: string | null;
  questionData: { question: any; section: any } | null;
  answers: Record<string, AnswerData>;
  unsavedQuestions: Set<string>;
  selectedIndexes: Set<string>;
  isGenerating: Record<string, boolean>;
  isMultiStepGenerating: boolean;
  savingQuestions: Set<string>;
  useMultiStep: boolean;
  showAIPanel: boolean;
  filterType: string;
  onSelectQuestion: (questionId: string) => void;
  onAnswerChange: (questionId: string, value: string) => void;
  onSave: (questionId: string) => void;
  onGenerateAnswer: (questionId: string) => void;
  onSourceClick: (source: AnswerSource) => void;
  onUseContent: (source: AnswerSource) => void;
  onMultiStepToggle: (enabled: boolean) => void;
  rfpDocument?: any;
  searchQuery?: string;
}

export function QuestionsTabsContent({
  questions,
  selectedQuestion,
  questionData,
  answers,
  unsavedQuestions,
  selectedIndexes,
  isGenerating,
  isMultiStepGenerating,
  savingQuestions,
  useMultiStep,
  showAIPanel,
  filterType,
  onSelectQuestion,
  onAnswerChange,
  onSave,
  onGenerateAnswer,
  onSourceClick,
  onUseContent,
  onMultiStepToggle,
  rfpDocument,
  searchQuery
}: QuestionsTabsContentProps) {
  const getFilterTitle = () => {
    switch (filterType) {
      case "answered": return "Answered Questions";
      case "unanswered": return "Unanswered Questions";
      default: return "Question Navigator";
    }
  };

  const getEmptyMessage = () => {
    switch (filterType) {
      case "answered": return "No answered questions found";
      case "unanswered": return "No unanswered questions found";
      default: return "No questions found";
    }
  };

  // Get sources for the selected question
  const currentSources = selectedQuestion ? (answers[selectedQuestion]?.sources || []) : [];

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-12 bg-slate-100 dark:bg-slate-900 p-4 rounded-xl">
      {/* Navigator Panel - ~25% width with distinct background */}
      <div className="lg:col-span-3 max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl bg-white dark:bg-slate-950 shadow-sm border border-slate-200 dark:border-slate-800">
        {filterType === "all" && rfpDocument ? (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 rounded-t-xl">
              <h2 className="font-semibold text-sm tracking-tight text-slate-800 dark:text-slate-200">Question Navigator</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Browse all questions</p>
            </div>
            <div className="p-3 flex-1">
              <QuestionNavigator
                sections={rfpDocument.sections}
                answers={answers}
                unsavedQuestions={unsavedQuestions}
                onSelectQuestion={(id) => onSelectQuestion(id)}
                searchQuery={searchQuery}
              />
            </div>
          </div>
        ) : (
          <QuestionsFilter
            questions={questions}
            answers={answers}
            unsavedQuestions={unsavedQuestions}
            selectedQuestion={selectedQuestion}
            onSelectQuestion={onSelectQuestion}
            filterType={filterType}
            title={getFilterTitle()}
            emptyMessage={getEmptyMessage()}
          />
        )}
      </div>
      
      {/* Editor Panel - ~42% width with distinct background */}
      <div className="lg:col-span-5 max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl bg-white dark:bg-slate-950 shadow-sm border border-slate-200 dark:border-slate-800 p-4">
        {selectedQuestion && questionData ? (
          <div className="space-y-4">
            <QuestionEditor
              question={questionData.question}
              section={questionData.section}
              answer={answers[selectedQuestion]}
              selectedIndexes={selectedIndexes}
              isUnsaved={unsavedQuestions.has(selectedQuestion)}
              isSaving={savingQuestions.has(selectedQuestion)}
              isGenerating={isGenerating[selectedQuestion] || isMultiStepGenerating}
              useMultiStep={useMultiStep}
              onAnswerChange={(value) => onAnswerChange(selectedQuestion, value)}
              onSave={() => onSave(selectedQuestion)}
              onGenerateAnswer={() => onGenerateAnswer(selectedQuestion)}
              onMultiStepToggle={onMultiStepToggle}
            />

            {showAIPanel && <AISuggestionsPanel questionId={selectedQuestion} />}
          </div>
        ) : (
          <div className="flex h-[400px] items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="text-center px-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📝</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                Select a question to get started
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Choose from the {filterType === "all" ? "navigator" : "list"} on the left
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Source Panel - ~33% width with distinct background */}
      <div className="lg:col-span-4 max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
        <SourceSidePanel
          sources={currentSources}
          onSourceClick={onSourceClick}
          onUseContent={onUseContent}
          questionText={questionData?.question?.question}
          className="h-full min-h-[400px] bg-transparent border-0"
        />
      </div>
    </div>
  );
} 