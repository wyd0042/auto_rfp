'use client';

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Project } from "@/types/project";
import Link from "next/link";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/context/organization-context";

/**
 * Enhanced project interface with question metrics
 */
export interface EnhancedProject extends Project {
  completedQuestions?: number;
  totalQuestions?: number;
  client?: string;
  dueDate?: string | null;
}

export interface ProjectCardProps {
  project: EnhancedProject;
  onProjectDeleted?: () => void;
}

/**
 * Calculates the progress percentage for a project
 * @param completed - Number of completed questions
 * @param total - Total number of questions
 * @returns Progress percentage (0-100)
 */
export function calculateProgressPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Returns the appropriate badge variant based on status
 * @param status - Project status string
 * @returns Badge variant
 */
export function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "completed":
      return "default";
    case "in progress":
    case "in_progress":
      return "secondary";
    case "review":
      return "outline";
    case "draft":
      return "secondary";
    default:
      return "secondary";
  }
}

/**
 * Returns the appropriate badge color class based on status
 * @param status - Project status string
 * @returns Tailwind CSS classes for badge styling
 */
export function getStatusBadgeClasses(status: string): string {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "in progress":
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "review":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "draft":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    default:
      return "";
  }
}

export function ProjectCard({ project, onProjectDeleted }: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { refreshData } = useOrganization();
  
  const status = project.status ?? "In Progress"; // Default status
  const completedQuestions = project.completedQuestions ?? 0;
  const totalQuestions = project.totalQuestions ?? 0;
  const progressPercentage = calculateProgressPercentage(completedQuestions, totalQuestions);
  const statusBadgeClasses = getStatusBadgeClasses(status);

  const handleDeleteProject = async () => {
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }

      toast({
        title: 'Success',
        description: `Project "${project.name}" has been deleted successfully.`,
      });

      setShowDeleteDialog(false);
      
      // Refresh the organization context to update the switcher
      await refreshData();
      
      // Call the callback to refresh the project list
      if (onProjectDeleted) {
        onProjectDeleted();
      }
      
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <div className="relative h-full group">
        <Link href={`/projects/${project.id}`} className="block h-full">
          <Card 
            className="hover:shadow-lg hover:bg-accent/50 transition-all duration-200 cursor-pointer flex flex-col h-full min-h-[220px]"
            data-testid="project-card"
          >
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2" data-testid="project-card-name">
                    {project.name}
                  </CardTitle>
                  {project.client && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid="project-card-client">
                      {project.client}
                    </p>
                  )}
                  <CardDescription className="mt-1 line-clamp-2 min-h-[40px]">
                    {project.summary 
                      ? (project.summary.length > 80 
                          ? `${project.summary.substring(0, 80)}...` 
                          : project.summary)
                      : (project.description || 'No description available')
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge 
                    variant={getStatusBadgeVariant(status)} 
                    className={`flex-shrink-0 ${statusBadgeClasses}`}
                    data-testid="project-card-status"
                  >
                    {status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={handleMenuClick}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/projects/${project.id}`);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDeleteDialog(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end space-y-3">
              {/* Progress Section */}
              {totalQuestions > 0 && (
                <div className="space-y-2" data-testid="project-card-progress-section">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span 
                      className="font-medium" 
                      data-testid="project-card-progress-percentage"
                    >
                      {progressPercentage}%
                    </span>
                  </div>
                  <Progress 
                    value={progressPercentage} 
                    className="h-2"
                    data-testid="project-card-progress-bar"
                  />
                  <div 
                    className="flex items-center justify-between text-xs text-muted-foreground"
                    data-testid="project-card-metrics"
                  >
                    <span data-testid="project-card-questions-answered">
                      {completedQuestions} / {totalQuestions} questions answered
                    </span>
                  </div>
                </div>
              )}
              
              {/* Footer with date and due date */}
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                <span data-testid="project-card-created-date">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </span>
                {project.dueDate && (
                  <span 
                    className="text-amber-600 dark:text-amber-400"
                    data-testid="project-card-due-date"
                  >
                    Due {new Date(project.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description="This will permanently delete the project and all its associated data."
        itemName={project.name}
        isLoading={isDeleting}
      />
    </>
  );
}