"use client"

import { CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnswerData {
  text: string;
  sources?: any[];
}

interface QuestionWithSection {
  id: string;
  question: string;
  sectionTitle: string;
  sectionId: string;
}

interface QuestionsFilterProps {
  questions: QuestionWithSection[];
  answers: Record<string, AnswerData>;
  unsavedQuestions: Set<string>;
  selectedQuestion: string | null;
  onSelectQuestion: (questionId: string) => void;
  filterType: string;
  title: string;
  emptyMessage: string;
}

export function QuestionsFilter({
  questions,
  answers,
  unsavedQuestions,
  selectedQuestion,
  onSelectQuestion,
  filterType,
  title,
  emptyMessage
}: QuestionsFilterProps) {
  const getStatusIcon = (questionId: string) => {
    const hasAnswer = answers[questionId]?.text && answers[questionId].text.trim() !== '';
    
    if (filterType === "answered" && hasAnswer) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (filterType === "unanswered" && !hasAnswer) {
      return <div className="h-4 w-4 rounded-full border-2 border-slate-300" />;
    }
    
    return hasAnswer ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 border-slate-300" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 rounded-t-xl">
        <h2 className="font-semibold text-sm tracking-tight text-slate-800 dark:text-slate-200">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{questions.length} questions</p>
      </div>
      <div className="p-2 flex-1">
        <div className="space-y-1">
          {questions.map((question) => (
            <button
              key={question.id}
              className={cn(
                "flex w-full text-left items-start p-3 rounded-lg text-sm transition-all",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                unsavedQuestions.has(question.id) && "bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400",
                selectedQuestion === question.id && "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500"
              )}
              onClick={() => onSelectQuestion(question.id)}
            >
              <div className="flex w-full">
                <div className="flex-shrink-0 w-5 h-5 mt-0.5 mr-3">
                  {getStatusIcon(question.id)}
                </div>
                <div className={cn(
                  "flex-1 mr-2",
                  unsavedQuestions.has(question.id) && "text-amber-700 dark:text-amber-400"
                )}>
                  <div className="font-medium text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide mb-0.5">{question.sectionTitle}</div>
                  <div className="text-slate-600 dark:text-slate-400 line-clamp-2">{question.question}</div>
                  {unsavedQuestions.has(question.id) && (
                    <span className="inline-block mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {questions.length === 0 && (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">📋</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 