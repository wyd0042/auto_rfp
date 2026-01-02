"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { User, Users, UserX } from "lucide-react"
import { AssigneeFilterType } from "@/types/api"

// Re-export type for backward compatibility
export type { AssigneeFilterType } from "@/types/api"

/**
 * Props for the AssigneeFilter component
 */
export interface AssigneeFilterProps {
  currentFilter: AssigneeFilterType;
  onFilterChange: (filter: AssigneeFilterType) => void;
  counts?: {
    all: number;
    me: number;
    unassigned: number;
  };
}

/**
 * Filter options configuration for the assignee filter.
 * Used for property-based testing to verify filter options.
 */
export const ASSIGNEE_FILTER_OPTIONS: { value: AssigneeFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'me', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
];

/**
 * Filters questions based on the assignee filter type.
 * Used for property-based testing to verify filter correctness.
 * 
 * @param questions - Array of questions with assignee information
 * @param filterType - The filter type to apply
 * @param currentUserId - The current user's ID for "me" filter
 * @returns Filtered array of questions
 */
export function filterQuestionsByAssignee<T extends { assignee?: { id: string } | null }>(
  questions: T[],
  filterType: AssigneeFilterType,
  currentUserId: string | null
): T[] {
  switch (filterType) {
    case 'me':
      if (!currentUserId) return [];
      return questions.filter(q => q.assignee?.id === currentUserId);
    case 'unassigned':
      return questions.filter(q => !q.assignee);
    case 'all':
    default:
      return questions;
  }
}

/**
 * AssigneeFilter component for filtering questions by assignee.
 * Provides filter options: "All", "Assigned to me", "Unassigned"
 * 
 * Requirements: 5.1
 */
export function AssigneeFilter({ 
  currentFilter, 
  onFilterChange,
  counts 
}: AssigneeFilterProps) {
  return (
    <Tabs value={currentFilter} onValueChange={(value) => onFilterChange(value as AssigneeFilterType)}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="all" className="gap-1">
          <Users className="h-3.5 w-3.5" />
          All
          {counts && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {counts.all}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="me" className="gap-1">
          <User className="h-3.5 w-3.5" />
          Assigned to me
          {counts && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {counts.me}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="unassigned" className="gap-1">
          <UserX className="h-3.5 w-3.5" />
          Unassigned
          {counts && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {counts.unassigned}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
