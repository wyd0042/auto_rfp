'use client';

/**
 * ImprovementToolbar Component
 *
 * Displays four action buttons for text improvement with icons.
 * Shows loading spinner on active button during improvement.
 * Disables all buttons when text is empty or loading.
 * Shows undo button when canUndo is true.
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 5.1, 5.2, 5.3, 5.4**
 */

import * as React from 'react';
import { SpellCheck, Briefcase, Minimize2, List, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';
import { useTextImprovement } from '@/hooks/use-text-improvement';
import type { ImprovementAction } from '@/lib/services/text-improvement-types';
import { IMPROVEMENT_ACTIONS } from '@/lib/services/text-improvement-types';

/**
 * Props for the ImprovementToolbar component
 */
export interface ImprovementToolbarProps {
  /** The current text to improve */
  text: string;
  /** Callback when text is improved */
  onImprove: (improvedText: string) => void;
  /** Whether the toolbar is disabled */
  disabled?: boolean;
}

// ============================================================================
// Utility Functions (exported for testing)
// ============================================================================

/**
 * Check if text is empty or whitespace-only
 * 
 * **Feature: ai-response-improvement**
 * **Requirements: 5.2**
 * 
 * @param text - The text to check
 * @returns true if text is empty or whitespace-only
 */
export function isTextEmpty(text: string | null | undefined): boolean {
  return !text || text.trim().length === 0;
}

/**
 * Determine if improvement action buttons should be disabled
 * 
 * **Feature: ai-response-improvement**
 * **Requirements: 5.2, 5.3**
 * 
 * @param text - The current text
 * @param isLoading - Whether an improvement is in progress
 * @param disabled - External disabled prop
 * @returns true if buttons should be disabled
 */
export function shouldDisableButtons(
  text: string | null | undefined,
  isLoading: boolean,
  disabled: boolean
): boolean {
  return isTextEmpty(text) || isLoading || disabled;
}

/**
 * Exported utilities for testing
 */
export const improvementToolbarUtils = {
  isTextEmpty,
  shouldDisableButtons,
};

/**
 * Icon mapping for improvement actions
 */
const ACTION_ICONS: Record<ImprovementAction, React.ComponentType<{ className?: string }>> = {
  proofread: SpellCheck,
  make_professional: Briefcase,
  make_concise: Minimize2,
  convert_to_bullets: List,
};

/**
 * ImprovementToolbar Component
 *
 * Provides a toolbar with four text improvement actions and undo functionality.
 *
 * **Feature: ai-response-improvement**
 * **Requirements: 5.1, 5.2, 5.3, 5.4**
 */
export function ImprovementToolbar({
  text,
  onImprove,
  disabled = false,
}: ImprovementToolbarProps) {
  const { improve, isLoading, error, canUndo, undo, clearError } = useTextImprovement();
  const [activeAction, setActiveAction] = React.useState<ImprovementAction | null>(null);

  // All buttons should be disabled when text is empty, loading, or externally disabled
  // **Requirements: 5.2, 5.3**
  const areButtonsDisabled = shouldDisableButtons(text, isLoading, disabled);

  /**
   * Handle improvement action click
   * **Requirements: 5.1, 5.3**
   */
  const handleImprove = React.useCallback(
    async (action: ImprovementAction) => {
      if (areButtonsDisabled) return;

      setActiveAction(action);
      clearError();

      try {
        const improvedText = await improve(text, action);
        onImprove(improvedText);

        // Show success toast
        toast({
          title: 'Text improved',
          description: `Successfully applied "${IMPROVEMENT_ACTIONS[action].label}" improvement.`,
        });
      } catch (err) {
        // Show error toast
        // **Requirements: 1.4, 2.4, 3.4, 4.4**
        toast({
          title: 'Improvement failed',
          description: err instanceof Error ? err.message : 'Failed to improve text',
          variant: 'destructive',
        });
      } finally {
        setActiveAction(null);
      }
    },
    [areButtonsDisabled, clearError, improve, onImprove, text]
  );

  /**
   * Handle undo action
   * **Requirements: 6.2, 6.3**
   */
  const handleUndo = React.useCallback(() => {
    const previousText = undo();
    if (previousText !== null) {
      onImprove(previousText);
      toast({
        title: 'Undo successful',
        description: 'Restored previous text.',
      });
    }
  }, [onImprove, undo]);

  // Show error toast when error state changes
  React.useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error]);

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-md bg-muted/50"
      role="toolbar"
      aria-label="Text improvement actions"
    >
      {/* Improvement action buttons */}
      {(Object.keys(IMPROVEMENT_ACTIONS) as ImprovementAction[]).map((action) => {
        const config = IMPROVEMENT_ACTIONS[action];
        const Icon = ACTION_ICONS[action];
        const isActive = activeAction === action;

        return (
          <Tooltip key={action}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleImprove(action)}
                disabled={areButtonsDisabled}
                aria-label={config.label}
                aria-busy={isActive}
                data-testid={`improve-${action}`}
              >
                {isActive ? (
                  <Spinner size="sm" className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="sr-only md:not-sr-only md:ml-1 text-xs">
                  {config.label}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Undo button - only shown when canUndo is true */}
      {/* **Requirements: 6.1, 6.2, 6.3** */}
      {canUndo && (
        <>
          <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={disabled || isLoading}
                aria-label="Undo improvement"
                data-testid="improve-undo"
              >
                <Undo2 className="h-4 w-4" />
                <span className="sr-only md:not-sr-only md:ml-1 text-xs">
                  Undo
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo last improvement</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

export default ImprovementToolbar;
