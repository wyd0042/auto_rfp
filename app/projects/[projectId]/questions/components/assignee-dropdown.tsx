"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { ChevronDown, User, UserMinus, Loader2, AlertCircle } from "lucide-react"
import { AssigneeInfo, OrganizationMember } from "@/types/api"

// Re-export types for backward compatibility
export type { OrganizationMember } from "@/types/api"

/**
 * Props for the AssigneeDropdown component
 */
export interface AssigneeDropdownProps {
  questionId: string;
  currentAssignee: AssigneeInfo | null;
  organizationMembers: OrganizationMember[];
  onAssign: (userId: string | null) => Promise<void>;
  disabled?: boolean;
}

/**
 * Extracts the display text for a member in the dropdown.
 * Used for property-based testing to verify member display correctness.
 * 
 * @param member - The organization member
 * @returns The display text showing name and email
 */
export function getMemberDisplayText(member: OrganizationMember): { name: string; email: string } {
  return {
    name: member.name || "No name",
    email: member.email,
  };
}

/**
 * Extracts the user ID that will be passed to the assignment API.
 * Used for property-based testing to verify correct API call parameters.
 * 
 * @param member - The organization member selected
 * @returns The user ID to pass to the assignment API
 */
export function getAssignmentUserId(member: OrganizationMember): string {
  return member.userId;
}

/**
 * Determines if the unassign option should be shown.
 * Used for property-based testing to verify unassign option visibility.
 * 
 * @param currentAssignee - The current assignee or null
 * @returns true if unassign option should be shown
 */
export function shouldShowUnassignOption(currentAssignee: AssigneeInfo | null): boolean {
  return currentAssignee !== null;
}

/**
 * AssigneeDropdown component for selecting assignees in the question editor.
 * Displays a list of organization members and allows assignment/unassignment.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2
 */
export function AssigneeDropdown({
  questionId,
  currentAssignee,
  organizationMembers,
  onAssign,
  disabled = false,
}: AssigneeDropdownProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleAssign = async (userId: string | null) => {
    setIsLoading(true);
    try {
      await onAssign(userId);
      setIsOpen(false);
      
      if (userId === null) {
        toast.success("Question unassigned successfully");
      } else {
        const member = organizationMembers.find(m => m.userId === userId);
        const memberName = member?.name || member?.email || "team member";
        toast.success(`Question assigned to ${memberName}`);
      }
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign question. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const showUnassign = shouldShowUnassignOption(currentAssignee);

  // Handle empty members list
  if (organizationMembers.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="gap-2 text-slate-500"
      >
        <AlertCircle className="h-4 w-4" />
        No members available
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              Assign to
              <ChevronDown className="h-3 w-3 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Assign to team member</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Unassign option - only shown when question is assigned */}
        {showUnassign && (
          <>
            <DropdownMenuItem
              onClick={() => handleAssign(null)}
              className="gap-2 text-slate-600 dark:text-slate-400"
            >
              <UserMinus className="h-4 w-4" />
              <span>Unassign</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Organization members list */}
        {organizationMembers.map((member) => {
          const displayInfo = getMemberDisplayText(member);
          const isCurrentAssignee = currentAssignee?.id === member.userId;
          
          return (
            <DropdownMenuItem
              key={member.userId}
              onClick={() => handleAssign(getAssignmentUserId(member))}
              className={`flex flex-col items-start gap-0.5 py-2 ${
                isCurrentAssignee ? "bg-blue-50 dark:bg-blue-950" : ""
              }`}
              disabled={isCurrentAssignee}
            >
              <span className="font-medium text-sm">
                {displayInfo.name}
                {isCurrentAssignee && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                    (current)
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {displayInfo.email}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
