"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RecentProject {
  id: string;
  name: string;
  client: string;
  status: string;
  updatedAt: Date;
}

export interface RecentProjectsListProps {
  projects: RecentProject[];
  maxItems?: number;
  onProjectClick?: (projectId: string) => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  review:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

/**
 * Sort projects by updatedAt in descending order (most recent first)
 */
export function sortProjectsByRecent(projects: RecentProject[]): RecentProject[] {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Get the limited and sorted list of recent projects
 */
export function getRecentProjects(
  projects: RecentProject[],
  maxItems: number = 5
): RecentProject[] {
  const sorted = sortProjectsByRecent(projects);
  return sorted.slice(0, Math.min(maxItems, sorted.length));
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function RecentProjectsList({
  projects,
  maxItems = 5,
  onProjectClick,
}: RecentProjectsListProps) {
  const router = useRouter();
  const recentProjects = getRecentProjects(projects, maxItems);

  const handleClick = (projectId: string) => {
    if (onProjectClick) {
      onProjectClick(projectId);
    } else {
      router.push(`/projects/${projectId}`);
    }
  };

  return (
    <Card className="w-full" data-testid="recent-projects-list">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Projects</CardTitle>
      </CardHeader>
      <CardContent>
        {recentProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No projects yet
          </p>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  "bg-muted/50 hover:bg-muted cursor-pointer",
                  "transition-colors duration-200"
                )}
                onClick={() => handleClick(project.id)}
                data-testid={`recent-project-${project.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid="project-name">
                    {project.name}
                  </p>
                  <p
                    className="text-sm text-muted-foreground truncate"
                    data-testid="project-client"
                  >
                    {project.client}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      statusColors[project.status] || statusColors.draft
                    )}
                    data-testid="project-status"
                  >
                    {formatStatus(project.status)}
                  </Badge>
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap"
                    data-testid="project-updated"
                  >
                    {formatDistanceToNow(new Date(project.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
