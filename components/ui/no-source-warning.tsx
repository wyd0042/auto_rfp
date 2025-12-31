"use client"

import { AlertTriangle, FileText, HelpCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface NoSourceWarningProps {
  questionText?: string;
  className?: string;
}

/**
 * NoSourceWarning Component
 * 
 * Displays a prominent warning alert when no sources are found for an AI-generated response.
 * This helps users identify potentially hallucinated responses that are not grounded in documents.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export function NoSourceWarning({ questionText, className }: NoSourceWarningProps) {
  return (
    <Alert 
      className={cn(
        "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-800 dark:text-amber-400 font-semibold">
        No Sources Found
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">
          This response may not be grounded in your documents. The AI generated this answer without finding relevant source material, which could result in inaccurate or hallucinated information.
        </p>
        
        <div className="space-y-2">
          <p className="font-medium text-amber-800 dark:text-amber-400 text-sm">
            Suggested actions:
          </p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Add more relevant documents to your knowledge base</span>
            </li>
            <li className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Refine the question to be more specific or use different keywords</span>
            </li>
          </ul>
        </div>
        
        {questionText && (
          <div className="mt-3 pt-3 border-t border-amber-300 dark:border-amber-700">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Question: &quot;{questionText.length > 100 ? `${questionText.slice(0, 100)}...` : questionText}&quot;
            </p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
