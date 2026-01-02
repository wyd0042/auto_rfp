"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { User } from "lucide-react"
import { AssigneeInfo } from "@/types/api"

// Re-export AssigneeInfo for backward compatibility
export type { AssigneeInfo } from "@/types/api"

/**
 * Props for the AssigneeBadge component
 */
export interface AssigneeBadgeProps {
  assignee: AssigneeInfo | null;
  showTooltip?: boolean;
}

/**
 * Determines the display text for the assignee badge.
 * Used for property-based testing to verify badge display correctness.
 * 
 * @param assignee - The assignee information or null if unassigned
 * @returns The text that should be displayed in the badge
 */
export function getAssigneeBadgeDisplayText(assignee: AssigneeInfo | null): string {
  if (!assignee) {
    return "Unassigned";
  }
  // Prefer name if available, otherwise use email
  return assignee.name || assignee.email;
}

/**
 * Determines the tooltip content for the assignee badge.
 * Used for property-based testing to verify tooltip content correctness.
 * 
 * @param assignee - The assignee information or null if unassigned
 * @returns The tooltip content object with name and email, or null if unassigned
 */
export function getAssigneeBadgeTooltipContent(assignee: AssigneeInfo | null): { name: string; email: string } | null {
  if (!assignee) {
    return null;
  }
  return {
    name: assignee.name || "No name",
    email: assignee.email,
  };
}

/**
 * AssigneeBadge component displays the current assignee of a question.
 * Shows "Unassigned" when no assignee is set, or the assignee's name/email when assigned.
 * Includes a tooltip with full details on hover.
 * 
 * Requirements: 2.1, 2.2, 2.4
 */
export function AssigneeBadge({ assignee, showTooltip = true }: AssigneeBadgeProps) {
  const displayText = getAssigneeBadgeDisplayText(assignee);
  const tooltipContent = getAssigneeBadgeTooltipContent(assignee);
  
  const badgeContent = (
    <Badge 
      variant="outline" 
      className={assignee 
        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" 
        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
      }
    >
      <User className="h-3 w-3 mr-1" />
      {displayText}
    </Badge>
  );

  // If no tooltip needed or no assignee, just return the badge
  if (!showTooltip || !assignee) {
    return badgeContent;
  }

  // Wrap with tooltip for assigned questions
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeContent}
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <div className="font-medium">{tooltipContent?.name}</div>
          <div className="text-xs opacity-80">{tooltipContent?.email}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
